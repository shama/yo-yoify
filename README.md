# yo-yoify

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![Downloads][downloads-image]][downloads-url]
[![js-standard-style][standard-image]][standard-url]

Transform [yo-yo][yo-yo-url] or [bel][bel-url] template strings into pure and
fast document calls.

## install

```shell
npm install yo-yoify --save-dev
```

## usage

When using Browserify, use as a plugin:

```shell
browserify entry.js -p yo-yoify -o bundle.js
```

## how this works

`yo-yo` and `bel`, without this transform, pass template literals to `hyperx`.
`hyperx` then parses and extracts the tags. `bel` then turns those tags into
calls to `document.createElement()`.

When using this transform, your template literals:

```js
var msg = 'hello!'
var element = yo`<div>${msg}</div>`
```

Transform into direct calls to the `document`:

```js
var msg = 'hello!'
var element = (function () {
  var bel0 = document.createElement("div")
  appendChild(bel0, [arguments[0]])
  return bel0
}(msg))
```

Which means, way better performance and compatibility with older browsers.

## interoperability

Creating standalone elements is awesome but we don't want to be greedy. So if
you're using React or virtual-dom and would like to directly integrate yo-yo/bel
elements, supply the `render` option of your choice:

**react**  
`browserify entry.js -p [ yo-yoify --render react ]`
```js
var BelElement = require('bel-element')
ReactDOM.render(<BelElement />, document.body)
```

**virtual-dom**  
`browserify entry.js -p [ yo-yoify --render vdom ]`
```js
var belElement = require('bel-element')
var vdom = require('virtual-dom')
var tree = vdom.create(vdom.h('div', [belElement]))
```

Now yo-yoify will transform those elements to call `React.createElement` or
`vdom.h` instead of `document.createElement`.

# license
(c) 2016 Kyle Robinson Young. MIT License

[yo-yo-url]: https://github.com/maxogden/yo-yo
[bel-url]: https://github.com/shama/bel
[npm-image]: https://img.shields.io/npm/v/yo-yoify.svg?style=flat-square
[npm-url]: https://npmjs.org/package/yo-yoify
[travis-image]: https://img.shields.io/travis/shama/yo-yoify/master.svg?style=flat-square
[travis-url]: https://travis-ci.org/shama/yo-yoify
[downloads-image]: http://img.shields.io/npm/dm/vel.svg?style=flat-square
[downloads-url]: https://npmjs.org/package/yo-yoify
[standard-image]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square
[standard-url]: https://github.com/feross/standard
