import fs from 'node:fs'
import path from 'node:path'
import { generateCommandIndexText } from '../src/core/commandIndex/generateCommandIndex'

const workspaceRoot = process.cwd()
const outputPath = path.join(workspaceRoot, 'command-index.txt')
const content = `${generateCommandIndexText()}\n`

fs.writeFileSync(outputPath, content, 'utf8')
console.log(`Generated ${outputPath}`)
