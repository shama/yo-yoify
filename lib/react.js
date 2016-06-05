var hyperx = require('hyperx')

var DELIM = '~!@|@|@!~'
var VARNAME = 'bel'

module.exports = function yoYoifyReact (node) {
  var args = [ node.quasis.map(cooked) ].concat(node.expressions.map(expr))

  var resultArgs = []
  var argCount = 0
  var tagCount = 0
  var hx = hyperx(function (tag, props, children) {
    var res = []

    // Build element attributes
    var attrs = []
    function addAttr (key, val) {
      key = JSON.stringify(key)
      attrs.push(`${key}:${val}`)
    }
    Object.keys(props).forEach(function (key) {
      var prop = props[key]
      var src = getSourceParts(prop)
      if (src) {
        if (src.arg) {
          var val = `arguments[${argCount}]`
          if (src.before) val = JSON.stringify(src.before) + ' + ' + val
          if (src.after) val += ' + ' + JSON.stringify(src.after)
          addAttr(key, val)
          resultArgs.push(src.arg)
          argCount++
        }
      } else {
        addAttr(key, JSON.stringify(prop))
      }
    })
    attrs = '{' + attrs.join(',') + '}'

    // Add children to the element
    var childs = []
    if (Array.isArray(children)) {
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
        childs = '[' + childs.join(',') + ']'
      } else {
        childs = '[]'
      }
    }

    // Build React.createElement
    var elname = VARNAME + tagCount
    tagCount++
    res.push(`var ${elname} = React.createElement(${JSON.stringify(tag)}, ${attrs}, ${childs})`)

    // Return delim'd parts as a child
    return DELIM + [elname, res.join('\n'), null].join(DELIM) + DELIM
  })

  // Run through hyperx
  var res = hx.apply(null, args)

  // Pull out the final parts and wrap in a closure with arguments
  var src = getSourceParts(res)
  if (src && src.src) {
    var params = resultArgs.join(',')
    node.parent.update(`(function () {
      var React = require('react')
      ${src.src}
      return ${src.name}
    }(${params}))`)
    console.log(node.parent.source())
    // debugger
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
