---
title: "[web入门]信息收集知识点"
date: 2026-10-26
category: web入门
series: web入门
draft: true
---

# [web入门]信息收集知识点
本文知识点总结于webshow中web入门的题集
## 源码注释
web中最最最简单的考法就是在html的注释中写入关键信息，html的注释格式为：`<!--注释内容-->`。查看源码的方式有很多，可以f12打开；可以使用`view-source:http://target`打开；可以在浏览器中点击开发者工具等等

## JS拦截
网站为防止自己的源码被人查看，会对用户的一些操作比如：f12,右键进行拦截。但是一般来说，我们都可以用`view-source:http://target.com`查看源码，或者用浏览器设置里的开发者工具打开

## HTTP响应头
web题目中，部分信息可能隐藏在http的响应中，可以用Burpsuite或者在开发者工具中的network里查看

## robots文件泄露
