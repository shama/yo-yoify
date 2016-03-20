# yo-yoify

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![Downloads][downloads-image]][downloads-url]
[![js-standard-style][standard-image]][standard-url]

Transform [yo-yo](https://github.com/maxogden/yo-yo) or
[bel](https://github.com/shama/bel) template strings into pure and fast
document calls.

## install

```shell
npm install yo-yoify --save-dev
```

## usage

When using Browserify, use as a transform:

```shell
browserify entry.js -t yo-yoify -o bundle.js
```

## how this works

`yo-yo` and `bel` pass template literals to `hyperx`. `hyperx` then parses and
extracts the tags. `bel` then turns those tags into calls to
`document.createElement()`.

When using this transform, your template literal:

```js
var msg = 'hello!'
var element = yo`<div>${msg}</div>`
```

Becomes direct calls to the `document`:

```js
var msg = 'hello!'
var element = (function () {
  var bel0 = document.createElement("div")
  appendChild(bel0, [arguments[0]])
  return bel0
}(msg))
```

Which means, way better performance.

# license
(c) 2016 Kyle Robinson Young. MIT License

[npm-image]: https://img.shields.io/npm/v/yo-yoify.svg?style=flat-square
[npm-url]: https://npmjs.org/package/yo-yoify
[travis-image]: https://img.shields.io/travis/shama/yo-yoify/master.svg?style=flat-square
[travis-url]: https://travis-ci.org/shama/yo-yoify
[downloads-image]: http://img.shields.io/npm/dm/vel.svg?style=flat-square
[downloads-url]: https://npmjs.org/package/yo-yoify
[standard-image]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square
[standard-url]: https://github.com/feross/standard
