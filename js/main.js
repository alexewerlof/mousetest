import { JJD } from 'jj'
import { createMouseTest } from './mouse-test.js'

const jjSvg = JJD.from(document).find('#mouse-test', true)

createMouseTest(jjSvg)
