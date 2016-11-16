var test = require('tape')
var browserify = require('browserify')
var fs = require('fs')
var path = require('path')

var FIXTURE = path.join(__dirname, 'fixture.js')

test('works', function (t) {
  t.plan(4)
  var src = 'var bel = require(\'bel\')\n  module.exports = function (data) {\n    var className = \'test\'\n    return bel`<div class="${className}">\n      <h1>${data}</h1>\n    </div>`\n  }'
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
  var src = 'var bel = require(\'bel\')\n  var className = \'test\'\n  var el = bel`<div class="before ${className} after"><div>`'
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
  var src = 'var bel = require(\'bel\')\n  var el = bel`<div>This is a <a href="#">test</a> to ensure <strong>strings</strong> get appended in the correct order.</div>`'
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

test('multiple values on single attribute', function (t) {
  t.plan(4)
  var src = 'var bel = require(\'bel\')\n  var a = \'testa\'\n  var b = \'testb\'\n  bel`<div class="${a} ${b}">`'
  fs.writeFileSync(FIXTURE, src)
  var b = browserify(FIXTURE, {
    transform: path.join(__dirname, '..')
  })
  b.bundle(function (err, src) {
    fs.unlinkSync(FIXTURE)
    t.ifError(err, 'no error')
    var result = src.toString()
    t.ok(result.indexOf('arguments[0]') !== -1, 'first argument')
    t.ok(result.indexOf('arguments[1]') !== -1, 'second argument')
    t.ok(result.indexOf('(a,b)') !== -1, 'calling with both variables')
    t.end()
  })
})

test('svg', function (t) {
  t.plan(2)
  var src = 'var bel = require(\'bel\')\n  var el = bel`<svg><line /></svg>`'
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

test('xlink:href', function (t) {
  t.plan(2)
  var src = 'var bel = require(\'bel\')\n  var el = bel`<use xlink:href=\'#cat\'/>`'
  fs.writeFileSync(FIXTURE, src)
  var b = browserify(FIXTURE, {
    browserField: false,
    transform: path.join(__dirname, '..')
  })
  b.bundle(function (err, src) {
    fs.unlinkSync(FIXTURE)
    t.iferror(err, 'no error')
    var result = src.toString()
    var match = result.indexOf('setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#cat")') !== -1
    t.ok(match, 'created namespaced xlink:href attribute')
    t.end()
  })
})

test('choo and friends', function (t) {
  t.plan(3)
  var src = 'const choo = require(\'choo\')\n  const bel = require(\'bel\')\n  const el1 = choo.view`<button>choo choo</button>`\n  const el2 = bel`<button>bel bel</button>`'
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
  var src = 'var bel = require(\'bel\')\n  module.exports = function (data) {\n    var className = (\'test\' + ) // <--- HERE\'S A SYNTAX ERROR\n    return bel`<div class="${className}">\n      <h1>${data}</h1>\n    </div>`\n  }'
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
  var src = 'var bel = require(\'bel\')\n  var el = bel`<div onload=${function (e) {\n    console.log(\'onload\', e)\n  }} onunload=${function (e) {\n    console.log(\'onunload\', e)\n  }}>bel</div>`'
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
