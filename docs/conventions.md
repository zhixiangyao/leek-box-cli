# 代码和界面规范

- 中文使用 ASCII `, . : ; ! ? ( )`, 标点后按英文规则留空格.
- 禁止中文全角标点, 顿号和 U+3000 空格.
- 不使用 emoji.
- 上述三条同样适用于 catalog 内容, 由 `tests/catalog.test.ts` 的标点守卫用例机械校验.
- 不新增兼容 alias, migration 或 deprecated API, 除非任务明确要求.
- 不新增第二份路由, overlay, poll interval 或 settings 状态.
- 不新增第二份文案来源: 显示文案只放 catalog, 组件与常量表存 `MessageKey` 并在渲染处解析.
- 不直接修改 Zustand store 内部字段来绕过 action, 测试 setup 和明确初始化除外.
- store 里的类型统一带该 store 的 feature 前缀 (含只经 Step 联合类型暴露的): `useStockListStore` 有 `StockListRow` / `StockListStep` / `StockListDependencies`, `useStockAddStore` 有 `StockAddCandidate`. 不写 `StockRow` / `StockCandidate` 这类省掉 feature 的形式. 唯一的例外是 `StockEntry`: 它由多个 store 共用, 定义在 settings/schema.
- 前缀动词区分 I/O: 走 HTTP 的用 `fetchX` (fetchQuotes, fetchQuoteNames), 从文件读的用 `loadX` (loadStocks, loadEntries).
- 同一种数据在各层用同一个名字: 删除网格的 `entries` 和确认弹窗的 `entries` 是同一份 `StockRemoveEntry[]`, 不一处叫 `entries` 另一处叫 `targets`. 泛型组件自己的词汇不算别名 (CheckboxGrid 的 `items` 指任意 T).
- 表格宽度由列元数据推导, CJK 宽度使用项目本地函数.
- command 不复制 Card, StatusBar, registry 或 persistence 逻辑.
- 所有退出走 Ink, 所有持久化退出前 flush.
