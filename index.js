var path = require('path')
var falafel = require('falafel')
var through = require('through2')
var hyperx = require('hyperx')
var acorn = require('acorn')

var SUPPORTED_VIEWS = ['bel', 'yo-yo', 'choo', 'choo/html']
var DELIM = '~!@|@|@!~'
var VARNAME = 'bel'
var SVGNS = 'http://www.w3.org/2000/svg'
var XLINKNS = '"http://www.w3.org/1999/xlink"'
var BOOL_PROPS = {
  autofocus: 1,
  checked: 1,
  defaultchecked: 1,
  disabled: 1,
  formnovalidate: 1,
  indeterminate: 1,
  readonly: 1,
  required: 1,
  selected: 1,
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
  'foreignObject', 'g', 'glyph', 'glyphRef', 'hkern', 'image', 'line',
  'linearGradient', 'marker', 'mask', 'metadata', 'missing-glyph', 'mpath',
  'path', 'pattern', 'polygon', 'polyline', 'radialGradient', 'rect',
  'set', 'stop', 'switch', 'symbol', 'text', 'textPath', 'title', 'tref',
  'tspan', 'use', 'view', 'vkern'
]
var onloadElementId = 0

module.exports = function yoYoify (file, opts) {
  if (/\.json$/.test(file)) return through()
  var bufs = []
  var viewVariables = []
  return through(write, end)
  function write (buf, enc, next) {
    bufs.push(buf)
    next()
  }
  function end (cb) {
    var src = Buffer.concat(bufs).toString('utf8')
    var res
    try {
      res = falafel(src, { ecmaVersion: 8, parser: acorn }, walk).toString()
    } catch (err) {
      return cb(err)
    }
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
      var name = node.parent.tag.name || (node.parent.tag.object && node.parent.tag.object.name)
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
      res.push('var ' + elname + ' = document.createElementNS(' + JSON.stringify(namespace) + ', ' + JSON.stringify(tag) + ')')
    } else {
      res.push('var ' + elname + ' = document.createElement(' + JSON.stringify(tag) + ')')
    }

    // If adding onload events
    if (props.onload || props.onunload) {
      var onloadParts = getSourceParts(props.onload)
      var onunloadParts = getSourceParts(props.onunload)
      var onloadCode = ''
      var onunloadCode = ''
      var elementIdentifier = JSON.stringify('o' + onloadElementId)
      onloadElementId += 1
      if (onloadParts && onloadParts[0].arg !== '') {
        onloadCode = 'args[' + argCount + '](' + elname + ')'
        resultArgs.push(onloadParts[0].arg)
        argCount++
      }
      if (onunloadParts && onunloadParts[0].arg !== '') {
        onunloadCode = 'args[' + argCount + '](' + elname + ')'
        resultArgs.push(onunloadParts[0].arg)
        argCount++
      }
      res.push('var args = arguments\n      onload(' + elname + ', function bel_onload () {\n        ' + onloadCode + '\n      }, function bel_onunload () {\n        ' + onunloadCode + '\n      }, ' + elementIdentifier + ')')
      needsOnLoad = true
      delete props.onload
      delete props.onunload
    }

    function addAttr (to, key, val) {
      // Normalize className
      if (key.toLowerCase() === '"classname"') {
        key = '"class"'
      }
      // The for attribute gets transformed to htmlFor, but we just set as for
      if (key === '"htmlFor"') {
        key = '"for"'
      }
      // If a property is boolean, set itself to the key
      if (BOOL_PROPS[key.slice(1, -1)]) {
        if (val.slice(0, 9) === 'arguments') {
          if (namespace) {
            res.push('if (' + val + ' && ' + key + ') ' + to + '.setAttributeNS(null, ' + key + ', ' + key + ')')
          } else {
            res.push('if (' + val + ' && ' + key + ') ' + to + '.setAttribute(' + key + ', ' + key + ')')
          }
          return
        } else {
          if (val === 'true') val = key
          else if (val === 'false') return
        }
      }
      if (key.slice(1, 3) === 'on') {
        res.push(to + '[' + key + '] = ' + val)
      } else {
        if (key === '"xlink:href"') {
          res.push(to + '.setAttributeNS(' + XLINKNS + ', ' + key + ', ' + val + ')')
        } else if (namespace && key.slice(0, 1) === '"') {
          res.push(to + '.setAttributeNS(null, ' + key + ', ' + val + ')')
        } else if (namespace) {
          res.push('if (' + key + ') ' + to + '.setAttributeNS(null, ' + key + ', ' + val + ')')
        } else if (key.slice(0, 1) === '"') {
          res.push(to + '.setAttribute(' + key + ', ' + val + ')')
        } else {
          res.push('if (' + key + ') ' + to + '.setAttribute(' + key + ', ' + val + ')')
        }
      }
    }

    // Add properties to element
    Object.keys(props).forEach(function (key) {
      var prop = props[key]
      var ksrcs = getSourceParts(key)
      var srcs = getSourceParts(prop)
      var k, val
      if (srcs) {
        val = ''
        srcs.forEach(function (src, index) {
          if (src.arg) {
            if (index > 0) val += ' + '
            if (src.before) val += JSON.stringify(src.before) + ' + '
            val += 'arguments[' + argCount + ']'
            if (src.after) val += ' + ' + JSON.stringify(src.after)
            resultArgs.push(src.arg)
            argCount++
          }
        })
      } else {
        val = JSON.stringify(prop)
      }
      if (ksrcs) {
        k = ''
        ksrcs.forEach(function (src, index) {
          if (src.arg) {
            if (index > 0) val += ' + '
            if (src.before) val += JSON.stringify(src.before) + ' + '
            k += 'arguments[' + argCount + ']'
            if (src.after) k += ' + ' + JSON.stringify(src.after)
            resultArgs.push(src.arg)
            argCount++
          }
        })
      } else {
        k = JSON.stringify(key)
      }
      addAttr(elname, k, val)
    })

    if (Array.isArray(children)) {
      var childs = []
      children.forEach(function (child) {
        var srcs = getSourceParts(child)
        if (srcs) {
          var src = srcs[0]
          if (src.src) {
            res.push(src.src)
          }
          if (src.name) {
            childs.push(src.name)
          }
          if (src.arg) {
            var argname = 'arguments[' + argCount + ']'
            resultArgs.push(src.arg)
            argCount++
            childs.push(argname)
          }
        } else {
          childs.push(JSON.stringify(child))
        }
      })
      if (childs.length > 0) {
        res.push('ac(' + elname + ', [' + childs.join(',') + '])')
      }
    }

    // Return delim'd parts as a child
    return DELIM + [elname, res.join('\n'), null].join(DELIM) + DELIM
  })

  // Run through hyperx
  var res = hx.apply(null, args)

  // Pull out the final parts and wrap in a closure with arguments
  var src = getSourceParts(res)
  if (src && src[0].src) {
    var params = resultArgs.join(',')
    // TODO: This should use the on-load version of choo/yo-yo/bel
    node.parent.update('(function () {\n      ' + (needsOnLoad ? 'var onload = require(\'' + require.resolve('on-load').replace(/\\/g, '\\\\') + // fix Windows paths
    '\')' : '') + '\n      var ac = require(\'' + path.resolve(__dirname, 'lib', 'appendChild.js').replace(/\\/g, '\\\\') + // fix Windows paths
    '\')\n      ' + src[0].src + '\n      return ' + src[0].name + '\n    }(' + params + '))')
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

  var chunk = parts.splice(0, 5)
  var arr = [{
    before: chunk[0],
    name: chunk[1],
    src: chunk[2],
    arg: chunk[3],
    after: chunk[4]
  }]
  while (parts.length > 0) {
    chunk = parts.splice(0, 4)
    arr.push({
      before: '',
      name: chunk[0],
      src: chunk[1],
      arg: chunk[2],
      after: chunk[3]
    })
  }

  return arr
}
