var test = require('tape')
var browserify = require('browserify')
var fs = require('fs')
var path = require('path')

var FIXTURE = path.join(__dirname, 'fixture.js')

test('works', function (t) {
  t.plan(4)
  var src = `var bel = require('bel')
  module.exports = function (data) {
    var className = 'test'
    return bel\`<div class="\${className}">
      <h1>\${data}</h1>
    </div>\`
  }`
  fs.writeFileSync(FIXTURE, src)
  var b = browserify(FIXTURE, {
    browserField: false,
    plugin: path.join(__dirname, '..')
  })
  b.bundle(function (err, src) {
    fs.unlinkSync(FIXTURE)
    t.ifError(err, 'no error')
    var result = src.toString()
    t.ok(result.indexOf('var bel = {}') !== -1, 'replaced bel dependency with {}')
    t.ok(result.indexOf('document.createElement("h1")') !== -1, 'created an h1 tag')
    t.ok(result.indexOf('setAttribute("class", arguments[1])') !== -1, 'set a class attribute')
    t.end()
  })
})

test('works for choo', function (t) {
  t.plan(3)
  var src = `var choo = require('choo')
  module.exports = function (data) {
    var className = 'test'
    return choo.view\`<div class="\${className}">
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
    t.ifError(err, 'no error')
    var result = src.toString()
    t.ok(result.indexOf('document.createElement("h1")') !== -1, 'created an h1 tag')
    t.ok(result.indexOf('setAttribute("class", arguments[1])') !== -1, 'set a class attribute')
    t.end()
  })
})

test('strings + template expressions', function (t) {
  t.plan(2)
  var src = `var bel = require('bel')
  var className = 'test'
  var el = bel\`<div class="before \${className} after"><div>\``
  fs.writeFileSync(FIXTURE, src)
  var b = browserify(FIXTURE, {
    browserField: false,
    plugin: path.join(__dirname, '..')
  })
  b.bundle(function (err, src) {
    fs.unlinkSync(FIXTURE)
    t.ifError(err, 'no error')
    var result = src.toString()
    t.ok(result.indexOf('bel0.setAttribute("class", "before " + arguments[0] + " after")') !== -1, 'concats strings + template expressions')
    t.end()
  })
})

test('append children in the correct order', function (t) {
  t.plan(2)
  var src = `var bel = require('bel')
  var el = bel\`<div>This is a <a href="#">test</a> to ensure <strong>strings</strong> get appended in the correct order.</div>\``
  fs.writeFileSync(FIXTURE, src)
  var b = browserify(FIXTURE, {
    browserField: false,
    plugin: path.join(__dirname, '..')
  })
  b.bundle(function (err, src) {
    fs.unlinkSync(FIXTURE)
    t.ifError(err, 'no error')
    var result = src.toString()
    var expected = '(bel2, ["This is a ",bel0," to ensure ",bel1," get appended in the correct order."])'
    t.ok(result.indexOf(expected) !== -1, 'append children in the correct order')
    t.end()
  })
})

test('svg', function (t) {
  t.plan(2)
  var src = `var bel = require('bel')
  var el = bel\`<svg><line /></svg>\``
  fs.writeFileSync(FIXTURE, src)
  var b = browserify(FIXTURE, {
    browserField: false,
    plugin: path.join(__dirname, '..')
  })
  b.bundle(function (err, src) {
    fs.unlinkSync(FIXTURE)
    t.ifError(err, 'no error')
    var result = src.toString()
    t.ok(result.indexOf('document.createElementNS("http://www.w3.org/2000/svg", "svg")' !== -1), 'created namespaced svg element')
    t.end()
  })
})
