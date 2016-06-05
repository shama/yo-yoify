var falafel = require('falafel')
var through = require('through2')
var renders = {
  document: require('./lib/document.js'),
  react: require('./lib/react.js'),
  vdom: require('./lib/virtual-dom.js')
}

module.exports = function (b, opts) {
  opts = opts || {}
  var render = opts.render || 'document'
  b.transform(transform, { global: true })
  function transform (file, opts) {
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
        renders[render](node)
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
}
