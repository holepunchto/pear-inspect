// import { Inspector } from '../../../index.js'
// Note that 'pear-inspect' is linked to file:../../../ in package.json because
// pear does not allow to include modules outside of the project folder
import { Inspector } from 'pear-inspect'

const inspector = new Inspector()
console.log(inspector.filename)
