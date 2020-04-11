/*
 * @Author: your name
 * @Date: 2020-02-20 09:47:26
 * @LastEditTime: 2020-03-30 16:04:12
 * @LastEditors: Please set LastEditors
 * @Description: In User Settings Edit
 * @FilePath: \utils\src\service_generator.js
 */

const superagent = require('superagent');
const axios = require('axios');
const inquirer = require('inquirer');
const fs = require('fs')
const path = require('path')
const childProcess = require('child_process')
const chalk = require('chalk');
const esprima = require('esprima');

const modelHelpNameParser = function () {
    const dirPath = path.resolve(process.cwd(), './src/utils')
    const helpPath= dirPath + '\\' + 'modelHelp' + '.js'
    try {
       const fsRes = fs.readFileSync(helpPath).toString()
       const fsAst = esprima.tokenize(fsRes)
       const modelNames = fsAst.filter((item, index) => {
           return item.type === 'Identifier' && item.value.lastIndexOf('Help') === item.value.length - 'Help'.length && fsAst[index - 1] && fsAst[index - 1].value === 'function'
       }).map(item => item.value)
       return modelNames
    }catch( e){
        console.log(e)
       return []
    }
   
}


// 模型数据处理方法名字
const modelHelpNames = modelHelpNameParser()

const isObj = function (result) {
    return Object.prototype.toString(result) === '[object Object]' && result !== null
}

const parametersTransform = function (parameters) {
    const query = {}
    const headers = {}
    const body = {}
    const paramters = {}
    parameters.forEach((parameter) => {
        if (parameter.in === 'query') {
            query[parameter.name] = parameter.default || ''
        }
        if (parameter.in === 'header') {
            headers[parameter.name] = parameter.default || ''
        }
        if (parameter.in === 'body') {
            body[parameter.name] = parameter.default || ''
        }
    })
    if (Object.keys(query).length) {
        paramters['query'] = query
    }
    if (Object.keys(headers).length) {
        paramters['headers'] = headers
    }
    if (Object.keys(body).length) {
        paramters['body'] = body
    }
    return paramters
}

// 转换返回数据
const responseDataTransform = function (result, definitions, mock) {
    if (result && result.type && typeof result.type === 'string') {
        // console.log(result.type)
        if (result.type === 'array') {
            if (mock === 'true') {
                let item = null
                if (result.items.originalRef && isObj(item = definitions[result.items.originalRef].properties)) {
                    item = responseDataTransform(item, definitions, mock)
                }
                return [item]
            } else {
                return []
            }
        }
        if (result.type === 'string') {
            return ''
        }
        if (result.type === 'integer') {
           return 0
        }
        if (result.type === 'number') {
            return 0
        }
    } 
    if (result && result.originalRef) {
        if (definitions[result.originalRef]) {
          return  {...responseDataTransform(definitions[result.originalRef].properties, definitions, mock)}
        }
    }
    return {} 
    // if (result) {
    //     const resultClone = {...result}
    //     Object.entries(result).forEach(([key, value]) => {
    //         resultClone[key] = responseDataTransform(value, definitions, mock)
    //     })
    //     return resultClone
    // }
}

const pathsTransform = function (paths, tags, definitions, mock) { 
    Object.entries(paths).map(([key, value]) => {
        let method = Object.keys(value)[0]
        const descriptionObj = value[method]
        const parameters = parametersTransform(descriptionObj.parameters)
        method = method.toLowerCase()
        const pathArr = key.split('/').slice(2)
        if (method === 'get') {
            pathArr.push('get')
        }
        let functionNameArr = pathArr.filter(item => item.indexOf('{') < 0)
        functionNameArr.unshift(functionNameArr.pop())
        functionNameArr = functionNameArr.map((value, index) => {
           if (index > 0) {
               const valueCharCodeArr = value.split('')
             return valueCharCodeArr.map((item, itemIndex) => {
                 if (itemIndex === 0) {
                    return item.toUpperCase()
                 }  
                 return item
             }).join('')
           }
           return value 
        })

        let data = undefined
        if (method === 'get') {
            if (descriptionObj.responses['200'].schema.originalRef) {
                const response = definitions[descriptionObj.responses['200'].schema.originalRef].properties
                const result = response.result
                if (result && isObj(result)) {
                    data = responseDataTransform(result, definitions, mock)
                }
            } else {
                data = {}
            }
            if (parameters.query && 'size' in parameters.query && 'current' in parameters.query) {
                data = {
                    list: data,
                    total: 0,
                    size: 0,
                    isPage: true
                }
            }
        }
        // console.log(response)
       
        tags[descriptionObj.tags[0]].paths.push({
            method,
            path: key,
            functionName: functionNameArr.join(''),
            summary: descriptionObj.summary,
            parameters,
            data,
            transform: pathArr.length !== functionNameArr.length
        })
    })
    return tags
}


const tagsTransform = function (tags) {
    const obj = {}
    tags.forEach((tag) => {
        const description = tag.description.split(' ')
        description.splice(-1, 1)
        obj[tag.name] = {
            description: description.join(''),
            paths: []
        }
    })
    return obj
}

const serviceGegerator = function (pathObj) {
    const dirPath = path.resolve(process.cwd(), './src/services')
    try{
      fs.mkdirSync(dirPath, { recursive: true });
    } catch(e){
       throw e
    }
    Object.entries(pathObj).forEach(([key, value]) => {
        const imports = ["import { stringify } from 'qs'", "import request from '@/utils/request'", "import { restfulUrlReplace } from '@/utils/utils'"]
        const functions = value.paths.map((item) => {
            let parameterStr = ''
            let queryStr = ''
            let dataStr = ''
            let paramStr = ''
            if (item.parameters) {
                let parameterArr = []
                if (item.parameters.query) {
                    parameterArr.push('query')
                    queryStr = `\?\${stringify(query)}`
                }
                if (item.parameters.body) {
                    parameterArr.push('data')
                    dataStr = `\n        data,`
                }
                if (item.transform) {
                    parameterArr.push('param')
                }
                if (parameterArr.length > 1) {
                    parameterStr = `{ ${parameterArr.join(',')} }`
                }
                if (parameterArr.length === 1) {
                    parameterStr = parameterArr[0]
                }
            }
            if (item.method === 'get' ) {
                if (item.transform) {
                    return `/**${key + item.summary}**/\nexport function ${item.functionName} ( ${parameterStr} ) {\n    return request(restfulUrlReplace(\`${item.path + queryStr}\`, param))\n}`
                }
              return `/**${key + item.summary}**/\nexport function ${item.functionName} ( ${parameterStr} ) {\n    return request(\`${item.path + queryStr}\`)\n}`
            }
            if (item.method === 'post') {
                if (item.transform) {
                    return `/**${item.summary + key}**/\nexport function ${item.functionName} ( ${parameterStr} ) {\n    return request(restfulUrlReplace(\`${item.path + queryStr}\`, param), {${dataStr}\n        method: 'post'    \n    })\n}`
                }
                return `/**${item.summary + key}**/\nexport function ${item.functionName} ( ${parameterStr} ) {\n    return request(\`${item.path + queryStr}\`, {${dataStr}\n        method: 'post'    \n    })\n}`
            }
        })
        childProcess.execSync(`del ${dirPath}\\${value.description}\.js`)
        fs.writeFileSync(dirPath + '/' + value.description + '.js', [...imports,...functions].join('\n'))
    })
}

const modelHelpGenerator = function (models) {
    const dirPath = path.resolve(process.cwd(), './src/models')
    const helpPath= dirPath + '/' + 'modelHelp' + '.js'
    const fsRes = fs.readFileSync(helpPath).toString()
    const fsAst = esprima.tokenize(fsRes)
    const modelNames = fsAst.filter(item => item.type === 'Identifier').map(item => item.value)
    // const template = models.map((modelName) => {
    //    return  `export function ${modelName}Help (value) {\n    return value\n}`
    // }).join('\n')
    // childProcess.execSync(`del ${dirPath}\\modelHelp\.js`)
    // fs.writeFileSync(dirPath + '/' + 'modelHelp' + '.js',template)
}
const modelGenerator = function (pathObj) {
    const dirPath = path.resolve(process.cwd(), './src/models')
    try{
      fs.mkdirSync(dirPath, { recursive: true });
    } catch(e){
       throw e
    }
    let models = []
    Object.entries(pathObj).forEach(([key, value]) => {
        childProcess.execSync(`del ${dirPath}\\${value.description}\.js`)
        const getRequests = value.paths.filter(({method}) => method === 'get')
        if (!getRequests.length) {
           return 
        }
        const imports = [`import { ${getRequests.map(({functionName}) => functionName).join(', ')} } from '@/services/${value.description}'`]
        const matchModelNames = []
        let stateArr = []
        getRequests.forEach((request) => {
            const modelName = request.functionName.split('').slice(3).join('')
            if (modelHelpNames && modelHelpNames.length && modelHelpNames.indexOf(modelName + 'Help') > -1) {
                matchModelNames.push(modelName + 'Help')
            }
            models.push(modelName)
            stateArr.push(`        ${request.functionName.split('').slice(3).join('')}: ${JSON.stringify(request.data)}`)
        })
        if (matchModelNames.length) {
            imports.push(`import { ${matchModelNames.join('\, ')} } from '@/utils/modelHelp'`)
        }
        const state = `    state: {\n${stateArr.join('\,\n')}\n    },`
        const effectGenerator = function () {
            return getRequests.map((request) => (`        \*${request.functionName}({payload}, { call, put }){\n            const res = yield call(${request.functionName}, payload);
                yield put({
                  type: 'set${request.functionName.split('').slice(3).join('')}',
                  payload: res,
                })\n                return res\n        }`)).join('\,\n')
        }
        const reducerGenerator = function () {
            return getRequests.map((request) => {
                const modelName = request.functionName.split('').slice(3).join('')
                let res = 'payload.result'
                if (request.data && request.data.isPage) {
                    res = `{\n                    list: payload.result\,\n                    total: payload.total\,\n                    size: payload.size\n                }`
                }
                if (modelHelpNames.indexOf(modelName + 'Help') > -1) {
                    res = `${modelName}Help(${res})`
                }
                return `        set${modelName}(state, { payload }){\n            return{\n                ...state\,\n                ${modelName}:${res}            \n            }\n        }`
            }).join('\,\n')
        }
        const effects = `    effects: {\n${effectGenerator()}\n    },`
        const reducers = `    reducers: {\n${reducerGenerator()}\n    },`
        const template = [`export default{`, `    namespace: '${value.description}',`, state , effects, reducers, '}']
        fs.writeFileSync(dirPath + '/' + value.description + '.js',[...imports, ...template].join('\n'))
    })
    // modelHelpGenerator(models)
}


// const baseUrl = 'http://gateway.yanshi.ygzuo.com'


module.exports = function (config) {
    const baseUrl = config.baseUrl || 'http://192.168.193.128:8080'
    const project = config.project
    const generator = function ({project}) {
        const url = `${baseUrl}/external/${project}/v2/api-docs`
        axios.get(url).then((res) => {
            const { tags, paths, definitions } = res.data
            const pathObj = pathsTransform(paths, tagsTransform(tags), definitions, config.mock)
            serviceGegerator(pathObj)
            modelGenerator(pathObj)
        }).catch(console.error);
    }
    if (!project) {
    inquirer
        .prompt([
            /* Pass your questions in here */
            {
                type: 'input',
                message: '请输入项目',
                name: 'project'
            }
        ])
        .then(answers => {
            // Use user feedback foconsole.dir(answer)r... whatever!!
            generator(answers)
        });
    } else {
        generator(config)
    }
    // promise with then/catch

}
