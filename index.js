var path = require('path')
var falafel = require('falafel')
var through = require('through2')
var hyperx = require('hyperx')

var SUPPORTED_VIEWS = ['bel', 'yo-yo', 'choo', 'choo/html']
var DELIM = '~!@|@|@!~'
var VARNAME = 'bel'
var SVGNS = 'http://www.w3.org/2000/svg'
var BOOL_PROPS = {
  autofocus: 1,
  checked: 1,
  defaultchecked: 1,
  disabled: 1,
  formnovalidate: 1,
  indeterminate: 1,
  readonly: 1,
  required: 1,
  willvalidate: 1
}
var SVG_TAGS = [
  'svg',
  'altGlyph', 'altGlyphDef', 'altGlyphItem', 'animate', 'animateColor',
  'animateMotion', 'animateTransform', 'circle', 'clipPath', 'color-profile',
  'cursor', 'defs', 'desc', 'ellipse', 'feBlend', 'feColorMatrix',
  'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting',
  'feDisplacementMap', 'feDistantLight', 'feFlood', 'feFuncA', 'feFuncB',
  'feFuncG', 'feFuncR', 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode',
  'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting',
  'feSpotLight', 'feTile', 'feTurbulence', 'filter', 'font', 'font-face',
  'font-face-format', 'font-face-name', 'font-face-src', 'font-face-uri',
  'foreignObject', 'glyph', 'glyphRef', 'hkern', 'image', 'line',
  'linearGradient', 'marker', 'mask', 'metadata', 'missing-glyph', 'mpath',
  'path', 'pattern', 'polygon', 'polyline', 'radialGradient', 'rect',
  'set', 'stop', 'switch', 'symbol', 'text', 'textPath', 'title', 'tref',
  'tspan', 'use', 'view', 'vkern'
]

module.exports = function yoYoify (file, opts) {
  if (/\.json$/.test(file)) return through()
  var bufs = []
  var viewVariables = []
  return through(write, end)
  function write (buf, enc, next) {
    bufs.push(buf)
    next()
  }
  function end () {
    var src = Buffer.concat(bufs).toString('utf8')
    var res = falafel(src, { ecmaVersion: 6 }, walk).toString()
    this.push(res)
    this.push(null)
  }
  function walk (node) {
    if (isSupportedView(node)) {
      if (node.arguments[0].value === 'bel') {
        // Only 0 out bel as yo-yo still needs yo.update()
        node.update('{}')
      }
      if (node.parent.type === 'VariableDeclarator') {
        viewVariables.push(node.parent.id.name)
      }
    }

    if (node.type === 'TemplateLiteral' && node.parent.tag) {
      var name = node.parent.tag.name || node.parent.tag.object && node.parent.tag.object.name
      if (viewVariables.indexOf(name) !== -1) {
        processNode(node)
      }
    }
  }
}

function processNode (node) {
  var args = [ node.quasis.map(cooked) ].concat(node.expressions.map(expr))
  var needsOnLoad = false

  var resultArgs = []
  var argCount = 0
  var tagCount = 0
  var hx = hyperx(function (tag, props, children) {
    var res = []

    // Whether this element needs a namespace
    var namespace = props.namespace
    if (!namespace && SVG_TAGS.indexOf(tag) !== -1) {
      namespace = SVGNS
    }

    // Create the element
    var elname = VARNAME + tagCount
    tagCount++
    if (namespace) {
      res.push(`var ${elname} = document.createElementNS(${JSON.stringify(namespace)}, ${JSON.stringify(tag)})`)
    } else {
      res.push(`var ${elname} = document.createElement(${JSON.stringify(tag)})`)
    }

    // If adding onload events
    if (props.onload || props.onunload) {
      var onloadParts = getSourceParts(props.onload)
      var onunloadParts = getSourceParts(props.onunload)
      var onloadCode = ''
      var onunloadCode = ''
      if (onloadParts.arg !== '') {
        onloadCode = `args[${argCount}](${elname})`
        resultArgs.push(onloadParts.arg)
        argCount++
      }
      if (onunloadParts.arg !== '') {
        onunloadCode = `args[${argCount}](${elname})`
        resultArgs.push(onunloadParts.arg)
        argCount++
      }
      res.push(`var args = arguments
      onload(${elname}, function bel_onload () {
        ${onloadCode}
      }, function bel_onunload () {
        ${onunloadCode}
      })`)
      needsOnLoad = true
      delete props.onload
      delete props.onunload
    }

    function addAttr (to, key, val) {
      // Normalize className
      if (key.toLowerCase() === 'classname') {
        key = 'class'
      }
      // The for attribute gets transformed to htmlFor, but we just set as for
      if (p === 'htmlFor') {
        p = 'for'
      }
      // If a property is boolean, set itself to the key
      if (BOOL_PROPS[key]) {
        if (val === 'true') val = key
        else if (val === 'false') return
      }
      var p = JSON.stringify(key)
      if (key.slice(0, 2) === 'on') {
        res.push(`${to}[${p}] = ${val}`)
      } else {
        if (namespace) {
          res.push(`${to}.setAttributeNS(null, ${p}, ${val})`)
        } else {
          res.push(`${to}.setAttribute(${p}, ${val})`)
        }
      }
    }

    // Add properties to element
    Object.keys(props).forEach(function (key) {
      var prop = props[key]
      var src = getSourceParts(prop)
      if (src) {
        if (src.arg) {
          var val = `arguments[${argCount}]`
          if (src.before) val = JSON.stringify(src.before) + ' + ' + val
          if (src.after) val += ' + ' + JSON.stringify(src.after)
          addAttr(elname, key, val)
          resultArgs.push(src.arg)
          argCount++
        }
      } else {
        addAttr(elname, key, JSON.stringify(prop))
      }
    })

    if (Array.isArray(children)) {
      var childs = []
      children.forEach(function (child) {
        var src = getSourceParts(child)
        if (src) {
          if (src.src) {
            res.push(src.src)
          }
          if (src.name) {
            childs.push(src.name)
          }
          if (src.arg) {
            var argname = `arguments[${argCount}]`
            resultArgs.push(src.arg)
            argCount++
            childs.push(argname)
          }
        } else {
          childs.push(JSON.stringify(child))
        }
      })
      if (childs.length > 0) {
        res.push(`ac(${elname}, [${childs.join(',')}])`)
      }
    }

    // Return delim'd parts as a child
    return DELIM + [elname, res.join('\n'), null].join(DELIM) + DELIM
  })

  // Run through hyperx
  var res = hx.apply(null, args)

  // Pull out the final parts and wrap in a closure with arguments
  var src = getSourceParts(res)
  if (src && src.src) {
    var params = resultArgs.join(',')
    // TODO: This should use the on-load version of choo/yo-yo/bel
    node.parent.update(`(function () {
      ${needsOnLoad ? `var onload = require('${require.resolve('on-load')}')` : ''}
      var ac = require('${path.resolve(__dirname, 'lib', 'appendChild.js')}')
      ${src.src}
      return ${src.name}
    }(${params}))`)
  }
}

function isSupportedView (node) {
  return (node.type === 'CallExpression' &&
    node.callee && node.callee.name === 'require' &&
    node.arguments.length === 1 &&
    SUPPORTED_VIEWS.indexOf(node.arguments[0].value) !== -1)
}

function cooked (node) { return node.value.cooked }
function expr (ex, idx) {
  return DELIM + [null, null, ex.source()].join(DELIM) + DELIM
}
function getSourceParts (str) {
  if (typeof str !== 'string') return false
  if (str.indexOf(DELIM) === -1) return false
  var parts = str.split(DELIM)
  return {
    before: parts[0],
    name: parts[1],
    src: parts[2],
    arg: parts[3],
    after: parts[4]
  }
}
