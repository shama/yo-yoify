var test = require('tape')
var browserify = require('browserify')
var vm = require('vm')
var fs = require('fs')
var path = require('path')

var FIXTURE = path.join(__dirname, 'fixture.js')

test('works', function (t) {
  t.plan(1)
  var src = `var bel = require('bel')
  module.exports = function (data) {
    var className = 'test'
    return bel\`<div class="\${className}">
      <h1>\${data}</h1>
    </div>\`
  }`
  fs.writeFileSync(FIXTURE, src)
  var b = browserify(FIXTURE, {
    browserField: false
  })
  b.transform(path.join(__dirname, '..'))
  b.bundle(function (err, src) {
    fs.unlinkSync(FIXTURE)
    t.ifError(err)
    vm.runInNewContext(src.toString(), { console: { log: log } })
    function log (msg) {
      t.ok(msg.indexOf('var bel = 0') !== -1, 'replaced bel dependency with 0')
      t.ok(msg.indexOf('document.createElement("h1")') !== -1, 'created an h1 tag')
      t.ok(msg.indexOf('setAttribute("class", arguments[1])') !== -1, 'set a class attribute')
      t.end()
    }
  })
})
