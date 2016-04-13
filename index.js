var falafel = require('falafel')
var through = require('through2')
var hyperx = require('hyperx')

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

module.exports = function (file, opts) {
  if (/\.json$/.test(file)) return through()
  var bufs = []
  var isBelOrYoYo = []
  return through(write, end)
  function write (buf, enc, next) {
    bufs.push(buf)
    next()
  }
  function end () {
    var src = Buffer.concat(bufs).toString('utf8')
    this.push(falafel(src, { ecmaVersion: 6 }, walk).toString())
    this.push(null)
  }
  function walk (node) {
    if (node.type === 'TemplateLiteral' &&
      node.parent.tag && isBelOrYoYo.indexOf(node.parent.tag.name) !== -1) {
      var args = [ node.quasis.map(cooked) ].concat(node.expressions.map(expr))

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
          res.push(`var ${elname} = document.createElementNS(${JSON.stringify(namespace)}', ${JSON.stringify(tag)})`)
        } else {
          res.push(`var ${elname} = document.createElement(${JSON.stringify(tag)})`)
        }

        function addAttr (to, key, val) {
          // Normalize className
          if (key.toLowerCase() === 'classname') {
            key = 'class'
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
            res.push(`appendChild(${elname}, [${childs.join(',')}])`)
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
        // TODO: Would be more efficient to stash this function higher up in scope
        node.parent.update(`(function () {
          function appendChild (el, childs) {
            for (var i = 0; i < childs.length; i++) {
              var node = childs[i];
              if (Array.isArray(node)) {
                appendChild(el, node)
                continue
              }
              if (typeof node === "number" ||
                typeof node === "boolean" ||
                node instanceof Date ||
                node instanceof RegExp) {
                node = node.toString()
              }

              if (typeof node === "string") {
                if (el.lastChild && el.lastChild.nodeName === "#text") {
                  el.lastChild.nodeValue += node
                  continue
                }
                node = document.createTextNode(node)
              }

              if (node && node.nodeType) {
                el.appendChild(node)
              }
            }
          }
          ${src.src}
          return ${src.name}
        }(${params}))`)
      }
    } else if (node.type === 'CallExpression' &&
      node.callee && node.callee.name === 'require' &&
      node.arguments.length === 1 &&
      (node.arguments[0].value === 'bel' || node.arguments[0].value === 'yo-yo')) {
      if (node.arguments[0].value === 'bel') {
        // Only 0 out bel as yo-yo still needs yo.update()
        node.update('{}')
      }
      if (node.parent.type === 'VariableDeclarator') {
        isBelOrYoYo.push(node.parent.id.name)
      }
    }
  }
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
