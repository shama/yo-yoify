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
    transform: path.join(__dirname, '..')
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

test('strings + template expressions', function (t) {
  t.plan(2)
  var src = `var bel = require('bel')
  var className = 'test'
  var el = bel\`<div class="before \${className} after"><div>\``
  fs.writeFileSync(FIXTURE, src)
  var b = browserify(FIXTURE, {
    browserField: false,
    transform: path.join(__dirname, '..')
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
    transform: path.join(__dirname, '..')
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
    transform: path.join(__dirname, '..')
  })
  b.bundle(function (err, src) {
    fs.unlinkSync(FIXTURE)
    t.ifError(err, 'no error')
    var result = src.toString()
    t.ok(result.indexOf('document.createElementNS("http://www.w3.org/2000/svg", "svg")' !== -1), 'created namespaced svg element')
    t.end()
  })
})

test('choo and friends', function (t) {
  t.plan(3)
  var src = `const choo = require('choo')
  const bel = require('bel')
  const el1 = choo.view\`<button>choo choo</button>\`
  const el2 = bel\`<button>bel bel</button>\``
  fs.writeFileSync(FIXTURE, src)
  var b = browserify(FIXTURE, {
    transform: path.join(__dirname, '..')
  })
  b.bundle(function (err, src) {
    fs.unlinkSync(FIXTURE)
    t.ifError(err, 'no error')
    var result = src.toString()
    t.ok(result.indexOf('const el1 = (function () {' !== -1), 'converted el1 to a iife')
    t.ok(result.indexOf('const el2 = (function () {' !== -1), 'converted el1 to a iife')
    t.end()
  })
})

test('emits error for syntax error', function (t) {
  var src = `var bel = require('bel')
  module.exports = function (data) {
    var className = ('test' + ) // <--- HERE'S A SYNTAX ERROR
    return bel\`<div class="\${className}">
      <h1>\${data}</h1>
    </div>\`
  }`
  fs.writeFileSync(FIXTURE, src)
  var b = browserify(FIXTURE, {
    browserField: false,
    transform: path.join(__dirname, '..')
  })
  b.bundle(function (err, src) {
    t.ok(err)
    t.end()
  })
})

test('onload/onunload', function (t) {
  t.plan(4)
  var src = `var bel = require('bel')
  var el = bel\`<div onload=\${function (e) {
    console.log('onload', e)
  }} onunload=\${function (e) {
    console.log('onunload', e)
  }}>bel</div>\``
  fs.writeFileSync(FIXTURE, src)
  var b = browserify(FIXTURE, {
    transform: path.join(__dirname, '..')
  })
  b.bundle(function (err, src) {
    fs.unlinkSync(FIXTURE)
    t.ifError(err, 'no error')
    var result = src.toString()
    t.ok(result.indexOf('onload(bel0, function bel_onload () {' !== -1), 'adds onload event to element')
    t.ok(result.indexOf('function bel_onunload () {' !== -1), 'adds onunload event to element')
    t.ok(result.indexOf(', "o0")' !== -1), 'it identified the element')
    t.end()
  })
})
