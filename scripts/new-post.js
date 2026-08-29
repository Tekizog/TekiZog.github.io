/* Create a new blog post with a folder-local Markdown file. */

import fs from "fs"
import path from "path"

function getDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  const hours = String(today.getHours()).padStart(2, "0")
  const minutes = String(today.getMinutes()).padStart(2, "0")
  const offset = -today.getTimezoneOffset()
  const offsetSign = offset >= 0 ? "+" : "-"
  const offsetHours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0")
  const offsetMinutes = String(Math.abs(offset) % 60).padStart(2, "0")

  return `${year}-${month}-${day}T${hours}:${minutes}:00${offsetSign}${offsetHours}:${offsetMinutes}`
}

const args = process.argv.slice(2)

if (args.length === 0) {
  console.error(`Error: No filename argument provided
Usage: pnpm new-post <filename>`)
  process.exit(1)
}

const inputName = args[0].trim()
const fileExtensionRegex = /\.(md|mdx)$/i
const parsedName = path.parse(inputName)
const postName = parsedName.name
const fileExtension = fileExtensionRegex.test(inputName) ? parsedName.ext.toLowerCase() : ".md"

if (!postName) {
  console.error("Error: Filename cannot be empty")
  process.exit(1)
}

const targetDir = "./src/content/posts/"
const parentDir = parsedName.dir ? path.join(targetDir, parsedName.dir) : targetDir
const postDir = path.join(parentDir, postName)
const fullPath = path.join(postDir, `${postName}${fileExtension}`)

if (fs.existsSync(fullPath)) {
  console.error(`Error: File ${fullPath} already exists`)
  process.exit(1)
}

fs.mkdirSync(postDir, { recursive: true })

const content = `---
title: ${JSON.stringify(postName)}
published: ${getDate()}
description: ''
image: ''
tags: []
category: ''
draft: false
lang: ''
---
`

fs.writeFileSync(fullPath, content)

console.log(`Post ${fullPath} created`)
