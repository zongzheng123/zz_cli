#! /usr/bin/env node

const program = require('commander');
const serviceGenerator = require('./service_generator')
const templateGenerator = require('./template/template_generator')
const package = require('../package.json')
program.version(package.version);

program
  .option('-s, --service', 'generate service from swagger')
  .option('-t, --template', 'generate template base on antd')
 
const args = program.parse(process.argv).args;
const config = {} 
const argsParse = args.map((arg) => [arg.split('=')[0], arg.split('=')[1]]).forEach(([key, value]) => {
    config[key] = value
})


if (process.argv.length === 2) {
  console.dir(program.help())
}
if (program.service) {
    serviceGenerator(config)
}
if (program.template) {
    templateGenerator(config)
}
