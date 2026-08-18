---
id: DV-0013
title: Reveal generated files in Finder
status: Implementing
owner: Duoasa
created: 2026-08-18
updated: 2026-08-18
depends_on: [DV-0003, DV-0009, DV-0012]
---

# DV-0013：在 Finder 中显示生成文件

## 摘要

让 macOS 桌面版在 Agent 生成或引用的本地文件上提供统一的内置预览和原生右键操作。单击文件
入口优先在 DeepViewer 预览侧栏打开；右键菜单继续提供“在 Finder 中显示”和“在 DeepViewer
中预览”。Renderer 只为既有文件入口附带会话工作区解析后的绝对路径；Electron 继续负责原生
菜单和系统调用。

## 需求

- R-001：Write、Edit、Read 工具行、产出文件按钮和回复内产出文件引用必须保留相对路径显示，
  同时为原生菜单提供由会话 `cwd` 解析的绝对路径。
- R-002：有效绝对文件路径的右键菜单必须显示“在 Finder 中显示”，点击后调用系统 Finder 定位；
  普通文本、相对路径和未知协议不得获得该操作。
- R-003：不得新增通用文件系统 IPC、在 Renderer 直接读取文件内容、记录路径或改变非 Agent
  产出文件入口的既有打开行为。
- R-004：文件右键菜单必须提供“在 DeepViewer 中预览”，复用 DV-0012 侧栏并选择对应文件；
  HTML 默认使用网页预览，其他受支持文本文件使用代码预览。
- R-005：Write、Edit、Read 工具行、产出文件按钮和回复内产出文件引用的单击操作必须优先使用
  DV-0012 内置侧栏打开目标；预览插件未加载或未接管事件时，必须回退到原有 Host 文件打开器。
- NFR-001：改动以 DeepSeek Harness `0.1.0-rc.7` 受控覆盖维护，并兼容中英文菜单。

## 验收条件

- AC-001：上述文件入口携带正确的 `cwd` 解析绝对路径，界面仍显示原相对路径。
- AC-002：有效文件右键菜单显示本地化 Finder 操作，点击后由 Electron 调用
  `shell.showItemInFolder`。
- AC-003：相对标题、普通文本与不支持协议不会被识别为文件目标。
- AC-004：相关测试、类型检查和桌面构建通过；Finder 交互由维护者人工验收。
- AC-005：点击“在 DeepViewer 中预览”后打开预览右栏，目标文件与预览模式正确。
- AC-006：单击上述 Agent 产出入口会打开预览右栏并选择对应文件；预览事件无人接管时仍调用原
  Host 文件打开器。

## 非目标

- 不增加文件管理、删除、重命名、任意路径浏览或第二套预览器。
- 不提交、封包或发布。

## 审批

- 决策：Approved by direct project instruction
- 审批人：Duoasa
- 日期：2026-08-18
