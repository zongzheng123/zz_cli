const traverse = require("@babel/traverse").default
const generate = require('@babel/generator').default;
const parser = require('@babel/parser')
const path = require('path')
const fs = require('fs')
const util = require('util');
const babel = require(`@babel/core`)
const test = require(path.resolve(__dirname, './test.js'))
const Babel = require('@babel/standalone')

const { transformSync, transformFileSync } = babel

const cascade = function (arr, initialvalue) {
    let result = initialvalue
    arr.forEach((item) => {
        result = item(result)
    })
    return result
}

const propsInjectTransform = function (ast) {
    return traverse(ast, {
        enter(path) {
            console.log(1111)
            // util.inspect(path, {
            //     depth: Infinity
            // })
          }
    })
}

const transformList = [propsInjectTransform]


module.exports = function (config) {
    // const code  = fs.readFileSync(path.join(__dirname, './template.js')).toString()
    // const ast = parser.parse(code, {
    //     sourceType: 'module',
    //     plugins: [
    //         // enable jsx and flow syntax
    //         "jsx"
    //       ]
    // })
    // const transformAst = cascade(transformList, ast)
    const {code, map, ast} = transformFileSync(path.join(__dirname, './template.js'), {
        plugins: [
                    // enable jsx and flow syntax
                    "@babel/plugin-transform-react-jsx",
                    test
                  ]
    })
    fs.writeFileSync(path.join(__dirname, '../../../index.js'), code)
    // console.dir(ast)
}