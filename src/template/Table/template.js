/*
 * @Author: your name
 * @Date: 2020-04-11 08:59:07
 * @LastEditTime: 2020-04-11 09:01:38
 * @LastEditors: Please set LastEditors
 * @Description: In User Settings Edit
 * @FilePath: \utils\src\template\Table\template.js
 */


import react from 'React'
import { Table } from 'antd'


export default class BaseTable extends React.Component{
    render () {
        return (
            <Table  bordered={true} />
        )
    }
}