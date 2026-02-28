export const API_REGISTRY = {
  'user.whoami': {
    label: '当前用户',
    params: {},
  },
  'schedule.export.all': {
    label: '导出所有进度节点数据',
    params: {
      objectType: { type: 'string', default: 'milestone', placeholder: '对象类型：project 或 milestone' },
      allMilestone: { type: 'string', default: '', placeholder: '仅当 objectType=milestone 时有效，填任意值导出全部节点，留空仅导出需统计的节点' },
      formatKey: { type: 'string', default: 'json', placeholder: '导出格式：excel/csv/json/text' },
      _help: {
        type: 'static',
        content: `进度节点数据导出使用指南:

【objectType - 对象类型】(必填)
project: 导出项目级别的进度数据
milestone: 导出里程碑/节点级别的进度数据

【allMilestone - 全量导出】(可选，仅 objectType=milestone 时有效)
留空: 仅导出需要统计的节点
填任意值(如 "1" 或 "true"): 导出所有节点（包括不需统计的）

【formatKey - 导出格式】(必填)
json: JSON 格式（推荐用于 API 集成）
excel: Excel 文件格式
csv: CSV 文件格式
text: 纯文本格式

【使用示例】
导出所有里程碑节点（JSON格式）:
{"objectType":"milestone","allMilestone":"1","formatKey":"json"}

导出需统计的里程碑节点:
{"objectType":"milestone","formatKey":"json"}

导出项目级别数据:
{"objectType":"project","formatKey":"json"}

【返回格式 - 重要】
⚠️ 此 API 不直接返回数据，而是返回一个下载链接！
返回格式：{"download URI": "http://pha.tp-link.com.cn/file/data/.../所有节点.json?download=1"}

需要再次 fetch 这个 URI 才能获取实际的 JSON 数据数组。

【返回的数据字段】(从下载的 JSON 文件中获取)
每条 milestone 记录包含以下字段：
- projectName: 项目名称（如 "工业相机Utility 1.5"）
- monogram: 项目编号（如 "SC8054"）
- milePHID: 里程碑 PHID（如 "PHID-MILE-xxx"）
- milestoneName: 里程碑名称（如 "第一轮提测"）
- preMilestone: 前置里程碑名称
- status: 状态（"已完成"/"进行中"/"未开始"）
- classify: 分类（"研发"/"测试"/"软件"）
- bindItem: 绑定项（节点类型）
- statistic: 是否统计（0/1）
- estimateFinishDate: 预计完成时间（Unix 时间戳）
- updateFinishDate: 更新完成时间
- actualFinishDate: 实际完成时间
- delayNum: 延期次数
- delayDays: 延期天数
- totalDelayDays: 总延期天数
- delayGroup: 延期责任组
- delayName: 延期原因名称
- delayType: 延期类型
- delayResp: 延期责任方
- delayDesc: 延期描述
- projectManager: 项目负责人
- productManager: 产品负责人
- developers: 开发工程师
- uri: 节点链接（指向 schedule 页面）

【获取项目 Milestone 的完整流程】
1. 调用 schedule.export.all 获取下载链接
2. fetch 下载链接获取所有 milestone 数据（2000+ 条）
3. 通过 projectName 字段筛选特定项目的 milestone
4. 可选：用 phid.query 批量查询 milePHID 获取更多详情

【注意事项】
- 此方法为 Conduit API，需要有效的 API token
- 返回的是文件下载链接，需要二次请求获取实际数据
- 下载的 JSON 文件包含全部项目的所有 milestone（数据量大）
- 建议在服务端处理，避免客户端下载大文件
- 数据包含完整的进度、延期、责任人等项目管理信息`
      }
    },
  },
  'schedule.pre.edit': {
    label: '创建或编辑进度项目',
    params: {
      projectNumber: { type: 'string', default: '', placeholder: 'DMS项目编号' },
      projectUrl: { type: 'string', default: '', placeholder: '项目链接' },
      projectName: { type: 'string', default: '', placeholder: 'DMS项目名称' },
      itemModelList: { type: 'string', default: '', placeholder: 'DMS代表机型' },
      startDate: { type: 'string', default: '', placeholder: '立项报告评审时间' },
      completeDate: { type: 'string', default: '', placeholder: '立项报告发布时间' },
      projectManager: { type: 'string', default: '', placeholder: '项目负责人（用户名或PHID）' },
      productManager: { type: 'string', default: '', placeholder: '产品负责人（用户名或PHID）' },
      developers: { type: 'string', default: '', placeholder: '开发工程师（用户名或PHID列表）' },
      assistant: { type: 'string', default: '', placeholder: '助理（用户名或PHID）' },
      mainChip: { type: 'string', default: '', placeholder: '主芯片' },
      sensorChip: { type: 'string', default: '', placeholder: 'sensor芯片' },
      wifiChip: { type: 'string', default: '', placeholder: 'wifi芯片' },
      chipInfo: { type: 'string', default: '', placeholder: '其他芯片信息/主芯片方案' },
      workload: { type: 'string', default: '', placeholder: '工作量' },
      productRequiredDate: { type: 'string', default: '', placeholder: '立项评审预计出货' },
      productType: { type: 'string', default: '', placeholder: '产品类型' },
      isOperatorModel: { type: 'string', default: '', placeholder: '销售渠道/是否运营商机型' },
      currentGoal: { type: 'string', default: '', placeholder: '运营商项目当前目标' },
      projectPriority: { type: 'string', default: '', placeholder: '项目优先级' },
      projectType: { type: 'string', default: '', placeholder: '项目类型' },
      projectDescription: { type: 'string', default: '', placeholder: '项目介绍' },
      subscribers: { type: 'string', default: '', placeholder: '订阅者（用户名或PHID列表）' },
      docsID: { type: 'string', default: '', placeholder: '需求输入DocsID' },
      createDefaultTaskBoard: { type: 'string', default: '', placeholder: '是否创建默认任务面板' },
      _help: {
        type: 'static',
        content: `进度项目创建/编辑使用指南:

【方法说明】
此方法用于以更易理解的方式创建或编辑 Schedule 项目，相比标准的 project.edit 更贴合业务需求。

【核心参数】
projectNumber: DMS项目编号（如 "SC20496"）
projectName: DMS项目名称
projectUrl: 项目链接
itemModelList: DMS代表机型

【时间参数】
startDate: 立项报告评审时间
completeDate: 立项报告发布时间
productRequiredDate: 立项评审预计出货

【人员参数】
projectManager: 项目负责人（可以是用户名或 PHID-USER-xxx）
productManager: 产品负责人
developers: 开发工程师（多个用逗号分隔或JSON数组）
assistant: 助理
subscribers: 订阅者（多个用逗号分隔或JSON数组）

【技术参数】
mainChip: 主芯片
sensorChip: sensor芯片
wifiChip: wifi芯片
chipInfo: 其他芯片信息/主芯片方案
workload: 工作量

【项目属性】
productType: 产品类型
isOperatorModel: 销售渠道/是否运营商机型
currentGoal: 运营商项目当前目标
projectPriority: 项目优先级
projectType: 项目类型
projectDescription: 项目介绍

【其他参数】
docsID: 需求输入DocsID
createDefaultTaskBoard: 是否创建默认任务面板

【使用示例】
创建新项目:
{
  "projectNumber": "SC20496",
  "projectName": "工业相机Utility 1.5",
  "projectManager": "liuminxin",
  "productManager": "zhangsan",
  "developers": ["dev1", "dev2"],
  "mainChip": "RK3588",
  "projectType": "新产品开发",
  "createDefaultTaskBoard": "true"
}

【注意事项】
- 此方法为 Conduit API，需要有效的 API token
- 返回值为 dict 类型，包含创建/编辑后的项目信息
- 人员参数可以使用用户名或 PHID，多个人员用数组或逗号分隔
- 时间参数格式需符合系统要求（通常为 Unix 时间戳或日期字符串）`
      }
    },
  },
  'user.search': {
    label: '用户搜索',
    params: {
      queryKey: { type: 'string', default: 'active', placeholder: '内置查询：active/all' },
      constraints: { type: 'json', default: '{"nameLike":"liu"}', placeholder: '搜索约束条件' },
      limit: { type: 'number', default: 50, placeholder: '结果数量限制' },
      _help: { 
        type: 'static',
        content: `用户搜索使用指南:

【queryKey - 内置查询】
active: 已启用用户
all: 所有用户

【constraints - 常用约束】
按用户名: {"nameLike":"liu"}
按精确用户名: {"usernames":["liuminxin","zhangsan"]}
按ID: {"ids":[123,456]}
按PHID: {"phids":["PHID-USER-1111"]}
管理员: {"isAdmin":true}
禁用用户: {"isDisabled":true}
机器人账号: {"isBot":true}
邮件列表: {"isMailingList":true}
待审批用户: {"needsApproval":true}
注册时间范围: {"createdStart":1609459200,"createdEnd":1640995200}
全文搜索: {"query":"关键词"}

【组合示例】
搜索管理员用户:
{"queryKey":"active","constraints":{"isAdmin":true}}

搜索包含"liu"的用户:
{"queryKey":"all","constraints":{"nameLike":"liu"}}

搜索注册时间在2021年的用户:
{"queryKey":"all","constraints":{"createdStart":1609459200,"createdEnd":1640995200}}`
      }
    },
  },
  'project.search': {
    label: '项目搜索',
    params: {
      queryKey: { type: 'string', default: 'all', placeholder: '内置查询键：all/active/joined/watching' },
      constraints: { type: 'json', default: '{"name":"项目名称"}', placeholder: '搜索约束条件' },
      attachments: { type: 'json', default: '{"members":true}', placeholder: '附加信息：members/watchers/ancestors' },
      order: { type: 'string', default: 'newest', placeholder: '排序：newest/oldest/updated/name' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制' },
      _help: { 
        type: 'static',
        content: `项目搜索使用指南:

【queryKey - 内置查询】
all: 所有项目
active: 已启用项目
joined: 已加入项目
watching: 已观察项目

【constraints - 常用约束】
按名称: {"name":"项目名"}
按成员: {"members":["PHID-USER-1111"]}
按颜色: {"colors":["red","blue"]}
按图标: {"icons":["fa-briefcase"]}
按项目编号: {"projectNumber":"PRJ-001"}
按项目经理: {"projectManagerPHID":["PHID-USER-1111"]}
按产品经理: {"productManagerPHID":["PHID-USER-1111"]}
按开发工程师: {"developersPHID":["PHID-USER-1111"]}
里程碑项目: {"isMilestone":true}
根项目: {"isRoot":true}
项目深度: {"minDepth":0,"maxDepth":2}
父项目: {"parents":["PHID-PROJ-1111"]}
祖先项目: {"ancestors":["PHID-PROJ-1111"]}
全文搜索: {"query":"关键词"}

【attachments - 附加信息】
{"members":true} - 项目成员列表
{"watchers":true} - 观察者列表
{"ancestors":true} - 祖先项目列表
{"members":true,"watchers":true} - 多个附加信息

【order - 排序方式】
newest: 创建日期最新优先
oldest: 创建日期最旧优先
updated: 更新日期最新优先
outdated: 更新日期最旧优先
name: 按名称排序
teamID: 按团队排序
priority: 按优先级排序
stageID: 按项目阶段排序

【组合示例】
搜索我参与的红色项目:
{"queryKey":"joined","constraints":{"colors":["red"]}}

搜索我管理的项目并获取成员信息:
{"queryKey":"all","constraints":{"projectManagerPHID":["PHID-USER-1111"]},"attachments":{"members":true},"order":"updated"}

查询某个项目的所有里程碑（Milestone）:
{"constraints":{"parents":["PHID-PROJ-u2jr2r5rfudcqdxwr7xe"],"isMilestone":true},"attachments":{"ancestors":true,"members":true}}

【重要提示】
- Milestone（里程碑）在 Phabricator 中是特殊的 Project 对象，通过 isMilestone:true 筛选
- 使用 parents 约束可以查询某个父项目下的所有 milestone
- Milestone 的 PHID 格式为 PHID-MILE-xxxx
- 可以通过 phid.query 查询 PHID-MILE-xxxx 获取 milestone 的基本信息
- schedule.export.all 可以导出 milestone 的完整进度数据（包括延期、前置节点等）`
      }
    },
  },
  'project.column.search': {
    label: '项目列搜索',
    params: {
      queryKey: { type: 'string', default: 'all', placeholder: '内置查询：all' },
      constraints: { type: 'json', default: '{}', placeholder: '搜索约束条件' },
      order: { type: 'string', default: 'newest', placeholder: '排序：newest/oldest' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制' },
      _help: { 
        type: 'static',
        content: `项目列搜索使用指南:

【queryKey - 内置查询】
all: 所有项目列

【constraints - 常用约束】
按ID: {"ids":[123,456]}
按PHID: {"phids":["PHID-PCOL-1111"]}
按项目: {"projects":["PHID-PROJ-1111"]}

【order - 排序方式】
newest: 创建日期最新优先
oldest: 创建日期最旧优先

【返回字段说明】
name: 列显示名称
project: 所属项目信息
proxyPHID: 代理对象PHID（如子项目或里程碑）
dateCreated: 创建时间戳
dateModified: 修改时间戳

【使用场景】
- 查找特定项目的所有列
- 获取工作板列信息
- 分析项目列结构

【示例】
搜索特定项目的列:
{"constraints":{"projects":["PHID-PROJ-1111"]}}

按ID搜索特定列:
{"constraints":{"ids":[123,456]}}`
      }
    },
  },
  'pool.iteam.all.search': {
    label: '资源池搜索',
    params: {
      queryKey: { type: 'string', default: 'all', placeholder: '内置查询：all' },
      constraints: { type: 'json', default: '{}', placeholder: '搜索约束条件' },
      order: { type: 'string', default: 'newest', placeholder: '排序：newest/oldest' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制' },
      _help: { 
        type: 'static',
        content: `资源池搜索使用指南:

【queryKey - 内置查询】
all: 所有资源

【constraints - 常用约束】
按ID: {"ids":[123,456]}
按PHID: {"phids":["PHID-POOL-1111"]}
按节点名称: {"itemName":"节点名称"}
按节点名称精确查询: {"itemName":"节点名称","preciseSearchOnItemName":true}

【order - 排序方式】
newest: 创建日期最新优先
oldest: 创建日期最旧优先

【返回字段说明】
itemName: 节点名称
statisticsRequired: 是否为统计节点（true表示统计节点）
dateCreated: 创建时间戳
dateModified: 修改时间戳
policy: 权限策略映射

【使用场景】
- 搜索资源池中的所有节点
- 查找特定的资源节点
- 识别统计节点
- 分析资源池结构

【示例】
搜索所有资源:
{"queryKey":"all"}

按节点名称搜索:
{"constraints":{"itemName":"服务器资源"}}

精确搜索节点:
{"constraints":{"itemName":"服务器资源","preciseSearchOnItemName":true}}`
      }
    },
  },
  'phid.query': {
    label: 'PHID查询',
    params: {
      phids: { type: 'json', default: '[]', placeholder: 'PHID列表，如：["PHID-USER-123","PHID-TASK-456"]' },
      _help: { 
        type: 'static',
        content: `PHID查询使用指南:

【phids 参数说明】
phids 是要查询的PHID（持久化ID）列表，可以是任何类型的对象PHID。
系统会根据PHID返回对应对象的详细信息。

【支持的PHID类型】
- PHID-USER-xxxx: 用户对象
- PHID-TASK-xxxx: 任务对象
- PHID-PROJ-xxxx: 项目对象
- PHID-MILE-xxxx: 里程碑对象（Milestone，项目的子节点）
- PHID-FILE-xxxx: 文件对象
- PHID-PURL-xxxx: URL对象
- PHID-DREV-xxxx: 代码审查对象
- PHID-CMIT-xxxx: 提交对象
- PHID-WEAK-xxxx: 其他类型对象

【返回结果格式】
返回一个字典，键为输入的PHID，值为对象的详细信息。
每个对象包含名称、类型、URI等基本信息。

【返回字段说明】
- name: 对象的显示名称
- fullName: 完整名称
- type: 对象类型
- status: 对象状态
- uri: 对象的访问链接
- dateCreated: 创建时间
- dateModified: 修改时间

【使用场景】
- 批量获取对象详细信息
- 验证PHID的有效性
- 获取对象的名称和链接
- 检查对象的访问权限
- 批量处理对象信息

【示例】
查询单个用户:
{"phids":["PHID-USER-1234"]}

查询多个对象:
{"phids":["PHID-USER-1234","PHID-TASK-5678","PHID-PROJ-9012"]}

查询任务和文件:
{"phids":["PHID-TASK-123","PHID-FILE-456"]}

查询里程碑（Milestone）:
{"phids":["PHID-MILE-j2lzpcizw257l33knj2m"]}

混合查询:
{"phids":["PHID-USER-789","PHID-DREV-123","PHID-PURL-456"]}

【返回示例】
{
  "PHID-USER-1234": {
    "name": "张三",
    "fullName": "张三 (zhangsan)",
    "type": "USER",
    "status": "active",
    "uri": "/p/zhangsan/",
    "dateCreated": 1234567890,
    "dateModified": 1234567890
  },
  "PHID-TASK-5678": {
    "name": "T123",
    "fullName": "修复登录问题",
    "type": "TASK",
    "status": "open",
    "uri": "/T123/",
    "dateCreated": 1234567890,
    "dateModified": 1234567890
  }
}

【注意事项】
- phids 参数是必需的，必须为JSON数组格式
- 每个PHID必须是有效的格式
- 如果PHID不存在或无权限访问，对应的值将为null
- 一次可以查询多个PHID，提高效率
- 返回的信息量取决于用户的访问权限`
      }
    },
  },
  'phid.lookup': {
    label: 'PHID查找',
    params: {
      names: { type: 'json', default: '[]', placeholder: '名称列表，如：["username","T123"]' },
      _help: { 
        type: 'static',
        content: `PHID查找使用指南:

【names 参数说明】
names 是要查找的对象名称列表，可以是用户名、任务ID、项目名称等。
系统会根据名称查找对应的PHID（持久化ID）。

【支持的查找类型】
- 用户名: "username" 或 "用户姓名"
- 任务ID: "T123" (T开头+数字)
- 项目名称: "项目名称"
- 其他对象名称

【返回结果格式】
返回一个字典，键为输入的名称，值为对应的PHID。
如果找不到对应的对象，该名称的值将为null。

【使用场景】
- 将用户名转换为PHID
- 查找任务或项目的PHID
- 批量获取对象标识符
- 验证对象名称是否存在

【示例】
查找单个用户:
{"names":["username"]}

查找多个对象:
{"names":["username","T123","项目名称"]}

查找任务ID:
{"names":["T123","T456"]}

混合查找:
{"names":["张三","T789","研发项目"]}

【返回示例】
{
  "username": "PHID-USER-1234",
  "T123": "PHID-TASK-5678",
  "项目名称": "PHID-PROJ-9012",
  "不存在的名称": null
}

【注意事项】
- names 参数是必需的，必须为JSON数组格式
- 查找是大小写敏感的
- 对于模糊匹配，系统会返回最接近的结果
- 如果找不到对象，对应的值为null
- 一次可以查找多个名称，提高效率`
      }
    },
  },
  'phame.post.edit': {
    label: '博客文章编辑',
    params: {
      objectIdentifier: { type: 'string', default: '', placeholder: '文章PHID或ID，留空创建新文章' },
      transactions: { type: 'json', default: '[{"type":"title","value":"文章标题"}]', placeholder: '见下方常用操作示例' },
      _help: { 
        type: 'static',
        content: `博客文章编辑使用指南:

【基本操作】
设置文章标题: [{"type":"title","value":"文章标题"}]
设置文章副标题: [{"type":"subtitle","value":"副标题内容"}]
设置文章内容: [{"type":"body","value":"文章内容，支持Remarkup格式"}]
设置可见性: [{"type":"visibility","value":"visible"}]

【博客管理】
选择博客: [{"type":"blog","value":"PHID-BLOG-1111"}]
添加评论: [{"type":"comment","value":"评论内容，支持Remarkup格式"}]

【项目管理】
添加项目标签: [{"type":"projects.add","value":["PHID-PROJ-1111"]}]
移除项目标签: [{"type":"projects.remove","value":["PHID-PROJ-1111"]}]
设置项目标签: [{"type":"projects.set","value":["PHID-PROJ-1111","PHID-PROJ-2222"]}]

【订阅管理】
添加订阅者: [{"type":"subscribers.add","value":["PHID-USER-1111"]}]
移除订阅者: [{"type":"subscribers.remove","value":["PHID-USER-1111"]}]
设置订阅者: [{"type":"subscribers.set","value":["PHID-USER-1111","PHID-USER-2222"]}]

【可见性选项】
visible: 可见（默认）
draft: 草稿
archived: 归档

【Remarkup 常用语法】
== 标题 == 
=== 子标题 ===
* 列表项
**粗体文本**
*斜体文本*
[[链接|显示文本]]
{{代码块}}
> 引用文本

【批量操作示例】
创建新文章:
[{"type":"blog","value":"PHID-BLOG-1111"},{"type":"title","value":"新文章标题"},{"type":"body","value":"== 内容 ==\\n\\n文章内容"}]

设置文章可见性:
[{"type":"visibility","value":"visible"}]

添加项目和订阅者:
[{"type":"projects.add","value":["PHID-PROJ-1111"]},{"type":"subscribers.add","value":["PHID-USER-2222"]}]

移动文章到其他博客:
[{"type":"blog","value":"PHID-BLOG-2222"}]

添加评论:
[{"type":"comment","value":"这是一条评论\\n\\n支持Remarkup格式"}]

完整文章创建:
[{"type":"blog","value":"PHID-BLOG-1111"},{"type":"title","value":"技术分享"},{"type":"subtitle","value":"前端开发心得"},{"type":"body","value":"== 概述 ==\\n\\n本文介绍前端开发技巧\\n\\n== 内容 ==\\n\\n详细内容..."}]

【注意事项】
- objectIdentifier 为空时创建新文章
- 创建新文章时必须指定博客（blog事务）
- transactions 必须为JSON数组格式
- 每个事务包含 type 和 value 字段
- 文章内容支持完整的Remarkup语法
- 博客PHID需要有效的博客对象标识符`
      }
    },
  },
  'phame.post.search': {
    label: '博客文章搜索',
    params: {
      queryKey: { type: 'string', default: 'live', placeholder: '查询类型：live/draft/archived/all' },
      constraints: { type: 'json', default: '{}', placeholder: '约束条件，见下方常用示例' },
      attachments: { type: 'json', default: '{}', placeholder: '附加信息，如：{"subscribers":true}' },
      order: { type: 'string', default: 'datePublished', placeholder: '排序：datePublished/newest/visitorCount' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制，默认100' },
      _help: { 
        type: 'static',
        content: `博客文章搜索使用指南:

【queryKey 查询类型】
live: 已发布的文章
draft: 草稿文章
archived: 归档文章
all: 全部文章

【常用约束条件】
按ID搜索: {"ids":[123,456]}
按PHID搜索: {"phids":["PHID-POST-1111"]}
按作者搜索: {"authorPHIDs":["PHID-USER-1111"]}
按博客搜索: {"blogPHIDs":["PHID-BLOG-1111"]}
按可见性搜索: {"visibility":["visible","draft"]}
按评分搜索: {"score":"80"}
全文搜索: {"query":"技术分享"}
按订阅者搜索: {"subscribers":["PHID-USER-1111"]}
按项目标签搜索: {"projects":["PHID-PROJ-1111"]}

【时间范围约束】
创建时间范围: {"createdStart":1609459200,"createdEnd":1612137600}
发布时间范围: {"publishedStart":1609459200,"publishedEnd":1612137600}

【attachments 附加信息】
获取订阅者信息: {"subscribers":true}
获取项目信息: {"projects":true}
组合获取: {"subscribers":true,"projects":true}

【order 排序选项】
datePublished: 发布日期（最新的优先）
visitorCount: 访问量（从高到低）
tokenCount: 点赞量（从高到低）
newest: 创建日期（最新的优先）
oldest: 创建日期（最旧的优先）
relevance: 相关性排序

【使用场景】
- 查找已发布的文章
- 搜索特定作者的文章
- 按博客筛选文章
- 按访问量排序热门文章
- 按时间范围查找文章
- 获取文章的订阅者信息

【示例】
查找已发布的文章:
{"queryKey":"live"}

搜索特定作者的文章:
{"constraints":{"authorPHIDs":["PHID-USER-1111"]}}

按博客搜索文章:
{"constraints":{"blogPHIDs":["PHID-BLOG-1111"]}}

按访问量排序:
{"order":"visitorCount"}

全文搜索:
{"constraints":{"query":"技术分享"},"order":"relevance"}

按时间范围搜索:
{"constraints":{"createdStart":1609459200,"createdEnd":1612137600}}

获取文章和订阅者信息:
{"queryKey":"all","attachments":{"subscribers":true}}

组合查询:
{"queryKey":"live","constraints":{"authorPHIDs":["PHID-USER-1111"],"blogPHIDs":["PHID-BLOG-1111"]},"attachments":{"subscribers":true,"projects":true},"order":"visitorCount","limit":50}

【返回字段说明】
title: 文章标题
slug: 文章路径标识
blogPHID: 所属博客PHID
authorPHID: 作者PHID
body: 文章内容
datePublished: 发布时间戳
dateCreated: 创建时间戳
dateModified: 修改时间戳
policy: 权限策略信息

【注意事项】
- queryKey 默认为 live（已发布文章）
- constraints 必须为JSON对象格式
- 时间戳使用epoch格式
- attachments 会增加查询时间和数据量
- 最多返回100个结果，可通过limit调整
- 支持分页查询（使用before/after参数）`
      }
    },
  },
  'paste.edit': {
    label: '代码片段编辑',
    params: {
      objectIdentifier: { type: 'string', default: '', placeholder: '代码片段PHID或ID，留空创建新片段' },
      transactions: { type: 'json', default: '[{"type":"title","value":"代码片段标题"}]', placeholder: '见下方常用操作示例' },
      _help: { 
        type: 'static',
        content: `代码片段编辑使用指南:

【基本操作】
设置标题: [{"type":"title","value":"代码片段标题"}]
设置内容: [{"type":"text","value":"代码内容"}]
设置语言: [{"type":"language","value":"text"}]
设置状态: [{"type":"status","value":"active"}] 或 [{"type":"status","value":"archived"}]

【空间管理】
移动到空间: [{"type":"space","value":"PHID-SPACE-1111"}]

【评论功能】
添加评论: [{"type":"comment","value":"评论内容，支持Remarkup格式"}]

【权限管理】
修改查看权限: [{"type":"view","value":"PHID-PROJ-1111"}]
修改编辑权限: [{"type":"edit","value":"PHID-USER-1111"}]

【项目管理】
添加项目标签: [{"type":"projects.add","value":["PHID-PROJ-1111"]}]
移除项目标签: [{"type":"projects.remove","value":["PHID-PROJ-1111"]}]
设置项目标签: [{"type":"projects.set","value":["PHID-PROJ-1111","PHID-PROJ-2222"]}]

【订阅管理】
添加订阅者: [{"type":"subscribers.add","value":["PHID-USER-1111"]}]
移除订阅者: [{"type":"subscribers.remove","value":["PHID-USER-1111"]}]
设置订阅者: [{"type":"subscribers.set","value":["PHID-USER-1111","PHID-USER-2222"]}]

【状态选项】
active: 激活状态（默认）
archived: 归档状态

【常用语言类型】
text: 纯文本
python: Python
javascript: JavaScript
java: Java
cpp: C++
php: PHP
sql: SQL
json: JSON
xml: XML
markdown: Markdown
yaml: YAML
shell: Shell脚本

【批量操作示例】
创建新代码片段:
[{"type":"title","value":"Python脚本"},{"type":"text","value":"print('Hello World')"},{"type":"language","value":"python"}]

设置代码片段和权限:
[{"type":"title","value":"配置文件"},{"type":"text","value":"{"name":"config","version":"1.0"}"},{"type":"language","value":"json"},{"type":"view","value":"public"}]

添加项目和订阅者:
[{"type":"projects.add","value":["PHID-PROJ-1111"]},{"type":"subscribers.add","value":["PHID-USER-2222"]}]

移动到空间并添加评论:
[{"type":"space","value":"PHID-SPACE-1111"},{"type":"comment","value":"移动到开发空间"}]

完整的代码片段创建:
[{"type":"title","value":"JavaScript函数"},{"type":"text","value":"function hello() {\\n  console.log('Hello World');\\n}\\nhello();"},{"type":"language","value":"javascript"},{"type":"projects.add","value":["PHID-PROJ-1111"]}]

【注意事项】
- objectIdentifier 为空时创建新代码片段
- transactions 必须为JSON数组格式
- 每个事务包含 type 和 value 字段
- 语言设置影响语法高亮显示
- 权限设置需要有效的PHID或常量值
- 空间PHID需要有效的空间对象标识符`
      }
    },
  },
  'paste.search': {
    label: '代码片段搜索',
    params: {
      queryKey: { type: 'string', default: 'active', placeholder: '查询类型：active/all/authored' },
      constraints: { type: 'json', default: '{}', placeholder: '约束条件，见下方常用示例' },
      attachments: { type: 'json', default: '{}', placeholder: '附加信息，如：{"content":true}' },
      order: { type: 'string', default: 'newest', placeholder: '排序：newest/oldest' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制，默认100' },
      _help: { 
        type: 'static',
        content: `代码片段搜索使用指南:

【queryKey 查询类型】
active: 激活的代码片段
all: 全部代码片段
authored: 我创建的代码片段

【常用约束条件】
按ID搜索: {"ids":[123,456]}
按PHID搜索: {"phids":["PHID-PASTE-1111"]}
按作者搜索: {"authors":["PHID-USER-1111"]}
按语言搜索: {"languages":["python","javascript"]}
按状态搜索: {"statuses":["active"]} 或 {"statuses":["archived"]}
按订阅者搜索: {"subscribers":["PHID-USER-1111"]}
按项目标签搜索: {"projects":["PHID-PROJ-1111"]}
按空间搜索: {"spaces":["PHID-SPACE-1111"]}

【时间范围约束】
创建时间范围: {"createdStart":1609459200,"createdEnd":1612137600}

【attachments 附加信息】
获取完整内容: {"content":true}
获取订阅者信息: {"subscribers":true}
获取项目信息: {"projects":true}
组合获取: {"content":true,"subscribers":true,"projects":true}

【order 排序选项】
newest: 创建日期（最新的优先）
oldest: 创建日期（最旧的优先）

【使用场景】
- 查找激活的代码片段
- 搜索特定作者的代码片段
- 按编程语言筛选代码片段
- 按项目标签筛选代码片段
- 获取代码片段的完整内容
- 按创建时间排序代码片段

【示例】
查找激活的代码片段:
{"queryKey":"active"}

搜索特定作者的代码片段:
{"constraints":{"authors":["PHID-USER-1111"]}}

按编程语言搜索:
{"constraints":{"languages":["python","javascript"]}}

按项目标签搜索:
{"constraints":{"projects":["PHID-PROJ-1111"]}}

按时间范围搜索:
{"constraints":{"createdStart":1609459200,"createdEnd":1612137600}}

获取代码片段和完整内容:
{"queryKey":"all","attachments":{"content":true}}

组合查询:
{"queryKey":"active","constraints":{"authors":["PHID-USER-1111"],"languages":["python"]},"attachments":{"content":true,"subscribers":true},"order":"newest","limit":50}

【返回字段说明】
title: 代码片段标题
authorPHID: 作者PHID
language: 语法高亮语言
status: 状态（active/archived）
spacePHID: 所属空间PHID
dateCreated: 创建时间戳
dateModified: 修改时间戳
policy: 权限策略信息

【注意事项】
- queryKey 默认为 active（激活代码片段）
- constraints 必须为JSON对象格式
- 时间戳使用epoch格式
- attachments 会增加查询时间和数据量
- content 附件会返回完整的代码内容
- 最多返回100个结果，可通过limit调整
- 支持分页查询（使用before/after参数）`
      }
    },
  },
  'passphrase.query': {
    label: '密码凭证查询',
    params: {
      ids: { type: 'json', default: '[]', placeholder: '凭证ID列表，如：[123,456]' },
      phids: { type: 'json', default: '[]', placeholder: '凭证PHID列表，如：["PHID-KEYC-1111"]' },
      needSecrets: { type: 'boolean', default: 'false', placeholder: '是否需要获取密码内容' },
      needPublicKeys: { type: 'boolean', default: 'false', placeholder: '是否需要获取公钥信息' },
      order: { type: 'string', default: 'id', placeholder: '排序方式，如：id/-id/name/-name' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制，默认100' },
      _help: { 
        type: 'static',
        content: `密码凭证查询使用指南:

【基本参数】
ids: 凭证ID列表，用于精确查询特定凭证
phids: 凭证PHID列表，用于精确查询特定凭证
needSecrets: 是否需要获取密码内容（敏感信息）
needPublicKeys: 是否需要获取公钥信息
order: 排序方式，支持按ID、名称等排序
limit: 结果数量限制，默认100

【查询方式】
按ID查询: {"ids":[123,456]}
按PHID查询: {"phids":["PHID-KEYC-1111"]}
获取所有凭证: {}
组合查询: {"ids":[123],"phids":["PHID-KEYC-2222"]}

【排序选项】
id: 按ID升序排序
-id: 按ID降序排序
name: 按名称升序排序
-name: 按名称降序排序
created: 按创建时间升序排序
-created: 按创建时间降序排序

【敏感信息处理】
needSecrets: true 时返回密码内容
needPublicKeys: true 时返回公钥信息
注意：密码内容为敏感信息，谨慎使用

【使用场景】
- 查询特定凭证的基本信息
- 获取凭证的密码内容（需要权限）
- 获取凭证的公钥信息
- 按名称或ID排序凭证列表
- 批量查询多个凭证信息

【示例】
查询特定ID的凭证:
{"ids":[123,456]}

查询特定PHID的凭证:
{"phids":["PHID-KEYC-1111"]}

获取凭证密码内容:
{"ids":[123],"needSecrets":true}

获取凭证公钥信息:
{"ids":[123],"needPublicKeys":true}

按名称排序查询:
{"order":"name","limit":50}

组合查询:
{"ids":[123,456],"needSecrets":false,"needPublicKeys":true,"order":"name"}

【返回字段说明】
id: 凭证ID
phid: 凭证PHID
name: 凭证名称
username: 用户名
isDestroyed: 是否已销毁
secret: 密码内容（needSecrets=true时返回）
publicKey: 公钥信息（needPublicKeys=true时返回）
dateCreated: 创建时间戳
dateModified: 修改时间戳
policy: 权限策略信息

【注意事项】
- ids 和 phids 不能同时为空，至少需要提供一个
- needSecrets=true 时需要相应权限
- 密码内容为敏感信息，请谨慎处理
- 最多返回100个结果，可通过limit调整
- 支持分页查询（使用before/after参数）
- 已销毁的凭证不会返回密码内容`
      }
    },
  },
  'packages.publisher.edit': {
    label: '软件包发布者编辑',
    params: {
      objectIdentifier: { type: 'string', default: '', placeholder: '发布者PHID或ID，留空创建新发布者' },
      transactions: { type: 'json', default: '[{"type":"name","value":"发布者名称"}]', placeholder: '见下方常用操作示例' },
      _help: { 
        type: 'static',
        content: `软件包发布者编辑使用指南:

【基本操作】
设置名称: [{"type":"name","value":"发布者名称"}]
修改编辑权限: [{"type":"edit","value":"PHID-PROJ-1111"}]

【项目管理】
添加项目标签: [{"type":"projects.add","value":["PHID-PROJ-1111"]}]
移除项目标签: [{"type":"projects.remove","value":["PHID-PROJ-1111"]}]
设置项目标签: [{"type":"projects.set","value":["PHID-PROJ-1111","PHID-PROJ-2222"]}]

【订阅者管理】
添加订阅者: [{"type":"subscribers.add","value":["PHID-USER-1111"]}]
移除订阅者: [{"type":"subscribers.remove","value":["PHID-USER-1111"]}]
设置订阅者: [{"type":"subscribers.set","value":["PHID-USER-1111","PHID-USER-2222"]}]

【权限管理】
修改编辑权限: [{"type":"edit","value":"PHID-PROJ-1111"}]
设置为公开编辑: [{"type":"edit","value":"public"}]
设置为仅管理员编辑: [{"type":"edit","value":"admin"}]

【批量操作示例】
创建新发布者:
[{"type":"name","value":"我的发布者"}]

设置发布者名称和权限:
[{"type":"name","value":"官方发布者"},{"type":"edit","value":"PHID-PROJ-1111"}]

添加项目标签和订阅者:
[{"type":"projects.add","value":["PHID-PROJ-1111"]},{"type":"subscribers.add","value":["PHID-USER-2222"]}]

设置多个项目标签:
[{"type":"projects.set","value":["PHID-PROJ-1111","PHID-PROJ-2222","PHID-PROJ-3333"]}]

移除特定项目标签:
[{"type":"projects.remove","value":["PHID-PROJ-1111"]}]

设置订阅者列表:
[{"type":"subscribers.set","value":["PHID-USER-1111","PHID-USER-2222","PHID-USER-3333"]}]

【组合操作】
创建发布者并添加项目标签:
[{"type":"name","value":"技术团队发布者"},{"type":"projects.add","value":["PHID-PROJ-1111"]}]

修改发布者名称和权限:
[{"type":"name","value":"新发布者名称"},{"type":"edit","value":"PHID-PROJ-2222"}]

重置项目标签并添加订阅者:
[{"type":"projects.set","value":["PHID-PROJ-1111"]},{"type":"subscribers.add","value":["PHID-USER-2222"]}]

完整的发布者创建:
[{"type":"name","value":"官方发布者"},{"type":"edit","value":"PHID-PROJ-1111"},{"type":"projects.add","value":["PHID-PROJ-2222"]},{"type":"subscribers.add","value":["PHID-USER-3333"]}]

【注意事项】
- objectIdentifier 为空时创建新发布者
- transactions 必须为JSON数组格式
- 每个事务包含 type 和 value 字段
- name 事务用于设置发布者名称
- edit 事务用于修改编辑权限
- 项目标签和订阅者都需要有效的PHID
- projects.set 会覆盖现有的所有项目标签
- subscribers.set 会覆盖现有的所有订阅者
- 权限设置需要有效的PHID或常量值
- 可以在一个操作中执行多个事务`
      }
    },
  },
  'file.allocate': {
    label: '文件预分配',
    params: {
      name: { type: 'string', default: '', placeholder: '文件名，必需参数' },
      contentLength: { type: 'number', default: 0, placeholder: '文件大小，必需参数' },
      contentHash: { type: 'string', default: '', placeholder: '内容哈希，可选' },
      viewPolicy: { type: 'string', default: '', placeholder: '查看权限，可选' },
      deleteAfterEpoch: { type: 'number', default: 0, placeholder: '过期时间，可选' },
      _help: { 
        type: 'static',
        content: `文件预分配使用指南:

【API功能】
准备上传文件，为文件分配PHID和存储空间。

【基本参数】
name: 文件名（必需）
contentLength: 文件大小（必需）
contentHash: 内容哈希（可选）
viewPolicy: 查看权限（可选）
deleteAfterEpoch: 过期时间（可选）

【参数类型】
name: string - 必需，文件名
contentLength: int - 必需，文件大小（字节）
contentHash: string - 可选，文件内容哈希
viewPolicy: string - 可选，查看权限策略
deleteAfterEpoch: int - 可选，文件过期时间戳

【使用场景】
- 分块上传前预分配文件空间
- 大文件上传准备
- 文件完整性验证
- 临时文件管理
- 批量文件上传准备

【示例】
基本预分配:
{"name":"document.pdf","contentLength":1024000}

带哈希预分配:
{"name":"image.png","contentLength":2048000,"contentHash":"sha256:abc123"}

设置权限:
{"name":"config.json","contentLength":5120,"viewPolicy":"public"}

临时文件:
{"name":"temp.txt","contentLength":1024,"deleteAfterEpoch":1640995200}

完整参数:
{"name":"backup.zip","contentLength":10485760,"contentHash":"sha256:def456","viewPolicy":"admin","deleteAfterEpoch":1643673600}

【返回信息】
成功预分配时返回：
- filePHID: 文件PHID
- uploadURL: 上传URL（如果适用）
- 其他文件元数据

失败时返回错误信息

【文件命名规范】
推荐命名规则：
- 使用有意义的文件名
- 包含适当的文件扩展名
- 避免特殊字符和空格
- 使用英文和数字组合
- 遵循系统命名约定

【文件大小计算】
常见文件大小参考：
- 1KB = 1024 字节
- 1MB = 1024 KB = 1,048,576 字节
- 1GB = 1024 MB = 1,073,741,824 字节

大小计算示例：
{"name":"small.txt","contentLength":1024}     // 1KB
{"name":"medium.pdf","contentLength":1048576} // 1MB
{"name":"large.zip","contentLength":10485760} // 10MB

【内容哈希】
哈希算法支持：
- SHA-256: 推荐使用，安全性高
- MD5: 兼容性好，但安全性较低
- SHA-1: 不推荐用于安全场景

哈希格式示例：
{"contentHash":"sha256:e3b0c44298fc1c149afbf4c8996fb924"}
{"contentHash":"md5:d41d8cd98f00b204e9800998ecf8427e"}

【权限策略】
常用权限值：
- public: 公开可见
- admin: 仅管理员可见
- 用户PHID: 仅特定用户可见
- 项目PHID: 仅项目成员可见
- 自定义策略: 根据系统配置

【过期时间】
deleteAfterEpoch 参数：
- Unix时间戳格式
- 0 表示永不过期
- 设置为未来时间戳实现自动删除

时间戳计算：
// JavaScript
const deleteAfterEpoch = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7天后

// Python
import time
delete_after_epoch = int(time.time()) + (7 * 24 * 60 * 60)  # 7天后

【使用流程】
1. 准备文件信息和内容
2. 计算文件大小和哈希
3. 调用 file.allocate 预分配
4. 获取文件PHID
5. 使用 file.uploadchunk 分块上传
6. 使用 file.complete 完成上传

【完整示例】
第一步: 准备文件信息
const fileInfo = {
    name: "report.pdf",
    contentLength: 2048576,  // 2MB
    contentHash: "sha256:abc123def456",
    viewPolicy: "public"
};

第二步: 预分配文件
const allocation = await file.allocate(fileInfo);

第三步: 获取PHID
const filePHID = allocation.filePHID;

第四步: 分块上传
await file.uploadchunk({
    filePHID: filePHID,
    byteStart: 0,
    data: "base64_encoded_chunk_data"
});

第五步: 完成上传
await file.complete({filePHID: filePHID});

【错误处理】
常见错误类型：
- 文件名无效: 检查文件名格式
- 大小超出限制: 检查文件大小限制
- 权限不足: 确认有上传权限
- 存储空间不足: 联系管理员
- 哈希格式错误: 验证哈希格式

【最佳实践】
文件准备：
- 验证文件名和大小
- 计算准确的内容哈希
- 设置适当的权限策略
- 考虑文件过期时间
- 预检查文件内容

安全性考虑：
- 验证文件类型和内容
- 设置适当的访问权限
- 使用强哈希算法
- 定期清理临时文件
- 监控文件上传活动

【性能优化】
- 批量预分配多个文件
- 缓存文件哈希计算结果
- 使用异步上传策略
- 监控存储空间使用
- 优化大文件处理

【相关API】
file.upload: 直接上传文件
file.uploadchunk: 分块上传文件
file.complete: 完成文件上传
file.search: 搜索文件
file.info: 获取文件详情

【应用场景】
分块上传: 大文件分块上传前的准备
批量上传: 同时准备多个文件上传
临时文件: 创建临时文件存储
备份上传: 备份文件的预分配
系统集成: 与其他系统的文件上传集成

【批量操作】
批量预分配示例：
const files = [
    {name: "doc1.pdf", contentLength: 1024000},
    {name: "doc2.pdf", contentLength: 2048000},
    {name: "image.png", contentLength: 512000}
];

const allocations = [];
for (const file of files) {
    try {
        const allocation = await file.allocate(file);
        allocations.push(allocation);
    } catch (error) {
        console.error(\`预分配失败: \${file.name}\`, error);
    }
}

【监控和日志】
预分配监控：
- 记录预分配操作
- 监控存储空间使用
- 统计预分配成功率
- 跟踪文件上传进度
- 分析预分配模式

日志记录：
- 文件名和大小
- 预分配时间戳
- 用户身份信息
- 分配的PHID
- 权限设置

【注意事项】
- name 必须是有效的文件名
- contentLength 必须准确匹配实际文件大小
- contentHash 应该是文件内容的真实哈希
- viewPolicy 需要符合系统权限配置
- deleteAfterEpoch 使用Unix时间戳格式
- 预分配后需要及时完成上传
- 注意存储空间限制和配额`
      }
    },
  },
  'maniphest.search': {
    label: '任务搜索',
    params: {
      queryKey: { type: 'string', default: 'open', placeholder: '查询类型：2I6425DSFT9f/sde2eHzIu2BL/authored/assigned/subscribed/open/all' },
      constraints: { type: 'json', default: '{}', placeholder: '约束条件，见下方常用示例' },
      attachments: { type: 'json', default: '{}', placeholder: '附加信息，如：{"subscribers":true}' },
      order: { type: 'string', default: 'priority', placeholder: '排序：priority/updated/outdated/newest/oldest/closed/title/custom.tp-link.estimated-date-complete' },
      before: { type: 'string', default: '', placeholder: '分页游标，获取前一页' },
      after: { type: 'string', default: '', placeholder: '分页游标，获取后一页' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制，默认100' },
      _help: { 
        type: 'static',
        content: `任务搜索使用指南:

【queryKey 查询类型】
2I6425DSFT9f: 未开始（自定义查询）
sde2eHzIu2BL: 我的任务（自定义查询）
authored: 我创建的（内置）
assigned: 已指派（内置）
subscribed: 已订阅（内置）
open: 已开启任务（内置）
all: 所有任务（内置）

【常用约束条件】
按ID搜索: {"ids":[123,456]}
按PHID搜索: {"phids":["PHID-TASK-1111"]}
按标题搜索: {"title":"任务标题"}
按作者搜索: {"authorPHIDs":["PHID-USER-1111"]}
按指派人搜索: {"assigned":["PHID-USER-1111"]}
按状态搜索: {"statuses":["open","closed"]}
按优先级搜索: {"priorities":[90,80]}
按子类型搜索: {"subtypes":["default","bug"]}
按父任务搜索: {"hasParents":true} 或 {"hasParents":false}
按子任务搜索: {"hasSubtasks":true} 或 {"hasSubtasks":false}
按父任务ID搜索: {"parentIDs":[123,456]}
按子任务ID搜索: {"subtaskIDs":[123,456]}
按项目标签搜索: {"projects":["PHID-PROJ-1111"]}
按订阅者搜索: {"subscribers":["PHID-USER-1111"]}
按空间搜索: {"spaces":["PHID-SPCE-1111"]}
按创建时间搜索: {"createdStart":1609459200,"createdEnd":1609545600}
按修改时间搜索: {"modifiedStart":1609459200,"modifiedEnd":1609545600}
按关闭时间搜索: {"closedStart":1609459200,"closedEnd":1609545600}
按关闭用户搜索: {"closerPHIDs":["PHID-USER-1111"]}
按可见策略搜索: {"followProjectViewPolicy":true}
全文搜索: {"query":"搜索关键词"}

【自定义字段约束】
任务类型: {"custom.mycompany.task-category":["开发","测试"]}
实际时间: {"custom.mycompany.actural-time":8}
交付链接: {"custom.mycompany.DeliveryLink":"http://example.com"}
预计工作量: {"custom.tp-link.estimated-days":5}
计划完成时间: {"custom.tp-link.estimated-date-complete":"2024-01-15"}
更新计划完成时间: {"custom.tp-link.update-date-complete":"2024-01-15"}
更新延迟次数: {"custom.tp-link.update-datedelay-times":3}
延迟类型: {"custom.tp-link.delay-type":"延期"}
更新完成时间说明: {"custom.tp-link.update-date-complete-instruction":"说明"}
任务分类: {"custom.tp-link.work-class":"开发"}
工作质量评分: {"custom.tp-link.work-score":"优秀"}
任务完成比例: {"custom.tp-link.complete-rate":"80%"}
计划重启时间: {"custom.tp-link.estimated-date-restart":"2024-01-15"}
暂停原因: {"custom.tp-link.reason-of-pause":"等待资源"}
工作质量评价: {"custom.tp-link.work-quality-evaluation":["优秀","良好"]}
工作效率评价: {"custom.tp-link.work-efficiency-evaluation":["高","中"]}

【attachments 附加信息】
获取工作板列信息: {"columns":true}
获取订阅者信息: {"subscribers":true}
获取项目信息: {"projects":true}

【order 排序选项】
priority: 优先级（优先级最高的优先）
updated: 更新日期（最新的优先）
outdated: 更新日期（最旧的优先）
newest: 创建日期（最新的优先）
oldest: 创建日期（最旧的优先）
closed: 关闭日期（最新的优先）
title: 标题（按字母顺序）
custom.tp-link.estimated-date-complete: 任务计划完成时间
-custom.tp-link.estimated-date-complete: 任务计划完成时间（倒序）
custom.tp-link.update-date-complete: 更新计划完成时间
-custom.tp-link.update-date-complete: 更新计划完成时间（倒序）
relevance: 相关性

【分页参数】
before: 分页游标，用于获取前一页结果
after: 分页游标，用于获取后一页结果
limit: 结果数量限制，默认100，最大100

【使用场景】
- 查找所有开启的任务
- 搜索特定用户创建的任务
- 按优先级筛选任务
- 按项目标签筛选任务
- 获取任务的订阅者信息
- 按创建时间排序任务
- 搜索特定状态的任务
- 分页浏览大量任务数据

【示例】
查找所有开启任务:
{"queryKey":"open"}

查找我的任务:
{"queryKey":"sde2eHzIu2BL"}

查找未开始任务:
{"queryKey":"2I6425DSFT9f"}

搜索我创建的任务:
{"queryKey":"authored"}

搜索已指派任务:
{"queryKey":"assigned"}

搜索已订阅任务:
{"queryKey":"subscribed"}

搜索特定ID的任务:
{"constraints":{"ids":[123,456]}}

按标题搜索任务:
{"constraints":{"title":"任务标题"}}

按作者搜索:
{"constraints":{"authorPHIDs":["PHID-USER-1111"]}}

按指派人搜索:
{"constraints":{"assigned":["PHID-USER-1111"]}}

按状态搜索:
{"constraints":{"statuses":["open","closed"]}}

按优先级搜索:
{"constraints":{"priorities":[90,80]}}

按子类型搜索:
{"constraints":{"subtypes":["default","bug"]}}

搜索有父任务的任务:
{"constraints":{"hasParents":true}}

搜索有子任务的任务:
{"constraints":{"hasSubtasks":true}}

按项目标签搜索:
{"constraints":{"projects":["PHID-PROJ-1111"]}}

按订阅者搜索:
{"constraints":{"subscribers":["PHID-USER-1111"]}}

按空间搜索:
{"constraints":{"spaces":["PHID-SPCE-1111"]}}

按创建时间范围搜索:
{"constraints":{"createdStart":1609459200,"createdEnd":1609545600}}

全文搜索:
{"constraints":{"query":"搜索关键词"}}

按任务类型搜索:
{"constraints":{"custom.mycompany.task-category":["开发","测试"]}}

按预计工作量搜索:
{"constraints":{"custom.tp-link.estimated-days":5}}

按计划完成时间搜索:
{"constraints":{"custom.tp-link.estimated-date-complete":"2024-01-15"}}

按工作质量评价搜索:
{"constraints":{"custom.tp-link.work-quality-evaluation":["优秀","良好"]}}

获取任务和订阅者信息:
{"queryKey":"open","attachments":{"subscribers":true}}

获取任务和项目信息:
{"queryKey":"open","attachments":{"projects":true}}

获取任务和所有附加信息:
{"queryKey":"open","attachments":{"subscribers":true,"projects":true,"columns":true}}

按计划完成时间排序:
{"order":"custom.tp-link.estimated-date-complete"}

按更新计划完成时间倒序排序:
{"order":"-custom.tp-link.update-date-complete"}

组合查询:
{"queryKey":"open","constraints":{"title":"任务标题","assigned":["PHID-USER-1111"],"priorities":[90]},"attachments":{"subscribers":true,"projects":true},"order":"priority","limit":50}

分页查询示例:
{"queryKey":"open","limit":50}
{"queryKey":"open","after":"1234","limit":50}
{"queryKey":"open","before":"5678","limit":50}

【返回字段说明】
title: 任务标题
description: 任务描述
authorPHID: 任务作者PHID
ownerPHID: 任务指派人PHID
status: 任务状态信息
priority: 任务优先级信息
points: 任务点值
subtype: 任务子类型
closerPHID: 关闭任务的用户PHID
dateClosed: 关闭时间戳
spacePHID: 空间PHID
dateCreated: 创建时间戳
dateModified: 修改时间戳
policy: 权限策略信息

【自定义字段返回】
custom.mycompany.task-category: 任务类型
custom.mycompany.actural-time: 实际时间
custom.mycompany.DeliveryLink: 交付链接
custom.tp-link.estimated-days: 预计工作量
custom.tp-link.estimated-date-complete: 计划完成时间
custom.tp-link.update-date-complete: 更新计划完成时间
custom.tp-link.work-class: 任务分类
custom.tp-link.work-score: 工作质量评分
custom.tp-link.complete-rate: 任务完成比例
custom.tp-link.work-quality-evaluation: 工作质量评价
custom.tp-link.work-efficiency-evaluation: 工作效率评价

【分页信息】
cursor: 包含分页游标信息
- limit: 实际使用的限制数量
- after: 获取下一页的游标
- before: 获取上一页的游标
- order: 使用的排序方式

【注意事项】
- queryKey 默认为 open（已开启任务）
- constraints 必须为JSON对象格式
- attachments 会增加查询时间和数据量
- 最多返回100个结果，可通过limit调整
- 支持分页查询（使用before/after参数）
- 自定义字段约束需要根据实际配置使用
- 时间字段使用Unix时间戳格式
- 自定义查询键（如2I6425DSFT9f）是用户保存的查询
- 分页时需要保持其他参数一致，只调整before/after`
      }
    },
  },
  'owners.edit': {
    label: '所有者编辑',
    params: {
      objectIdentifier: { type: 'string', default: '', placeholder: '所有者PHID或ID，留空创建新所有者' },
      transactions: { type: 'json', default: '[{"type":"name","value":"软件包名称"}]', placeholder: '见下方常用操作示例' },
      _help: { 
        type: 'static',
        content: `所有者编辑使用指南:

【基本操作】
设置名称: [{"type":"name","value":"软件包名称"}]
修改查看权限: [{"type":"view","value":"PHID-PROJ-1111"}]
修改编辑权限: [{"type":"edit","value":"PHID-PROJ-1111"}]

【所有者管理】
设置所有者: [{"type":"owners","value":["PHID-USER-1111","PHID-PROJ-1111"]}]

【控制权管理】
修改控制权规则: [{"type":"dominion","value":"strong"}]

【自动化设置】
启用自动审查: [{"type":"autoReview","value":"enabled"}]
启用自动审计: [{"type":"auditing","value":"enabled"}]

【描述和状态】
设置描述: [{"type":"description","value":"软件包描述"}]
设置状态: [{"type":"status","value":"active"}]
归档软件包: [{"type":"status","value":"archived"}]

【路径管理】
设置路径: [{"type":"paths.set","value":[{"repositoryPHID":"PHID-REPO-1111","path":"/src/path/","excluded":false}]}]

【批量操作示例】
创建新软件包:
[{"type":"name","value":"我的软件包"}]

设置软件包名称和描述:
[{"type":"name","value":"官方软件包"},{"type":"description","value":"官方软件包描述"}]

设置所有者和权限:
[{"type":"owners","value":["PHID-USER-1111","PHID-PROJ-1111"]},{"type":"view","value":"PHID-PROJ-1111"}]

启用自动化功能:
[{"type":"autoReview","value":"enabled"},{"type":"auditing","value":"enabled"}]

设置路径:
[{"type":"paths.set","value":[{"repositoryPHID":"PHID-REPO-1111","path":"/src/path/","excluded":false}]}]

设置多个路径:
[{"type":"paths.set","value":[{"repositoryPHID":"PHID-REPO-1111","path":"/src/path1/","excluded":false},{"repositoryPHID":"PHID-REPO-1111","path":"/src/path2/","excluded":true}]}]

【组合操作】
创建完整的软件包:
[{"type":"name","value":"技术团队软件包"},{"type":"description","value":"技术团队维护的软件包"},{"type":"owners","value":["PHID-USER-1111"]},{"type":"view","value":"PHID-PROJ-1111"},{"type":"autoReview","value":"enabled"}]

设置控制权和自动化:
[{"type":"dominion","value":"strong"},{"type":"autoReview","value":"enabled"},{"type":"auditing","value":"enabled"}]

修改软件包状态和路径:
[{"type":"status","value":"active"},{"type":"paths.set","value":[{"repositoryPHID":"PHID-REPO-1111","path":"/new/path/","excluded":false}]}]

完整的软件包配置:
[{"type":"name","value":"官方软件包"},{"type":"description","value":"官方软件包描述"},{"type":"owners","value":["PHID-USER-1111","PHID-PROJ-1111"]},{"type":"dominion","value":"strong"},{"type":"autoReview","value":"enabled"},{"type":"auditing","value":"enabled"},{"type":"view","value":"PHID-PROJ-1111"},{"type":"edit","value":"PHID-PROJ-1111"}]

【路径设置详解】
paths.set 事务的值格式:
[
  {
    "repositoryPHID": "PHID-REPO-1111",
    "path": "/src/path/to/directory/",
    "excluded": false
  }
]

repositoryPHID: 仓库的PHID
path: 路径（必须以/开头和结尾）
excluded: 是否排除该路径（false包含，true排除）

【注意事项】
- objectIdentifier 为空时创建新所有者
- transactions 必须为JSON数组格式
- 每个事务包含 type 和 value 字段
- name 事务用于设置软件包名称
- owners 事务用于设置所有者列表
- dominion 事务用于修改控制权规则
- autoReview 和 auditing 用于自动化功能
- paths.set 会覆盖现有的所有路径
- 权限设置需要有效的PHID或常量值
- 路径设置需要正确的格式和仓库PHID
- 可以在一个操作中执行多个事务`
      }
    },
  },
  'owners.search': {
    label: '所有者搜索',
    params: {
      queryKey: { type: 'string', default: 'all', placeholder: '查询类型：all/authority/active' },
      constraints: { type: 'json', default: '{}', placeholder: '约束条件，见下方常用示例' },
      attachments: { type: 'json', default: '{}', placeholder: '附加信息，如：{"paths":true}' },
      order: { type: 'string', default: 'newest', placeholder: '排序：name/newest/oldest/relevance' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制，默认100' },
      _help: { 
        type: 'static',
        content: `所有者搜索使用指南:

【queryKey 查询类型】
all: 全部软件包
authority: 拥有的软件包
active: 活跃的软件包

【常用约束条件】
按ID搜索: {"ids":[123,456]}
按PHID搜索: {"phids":["PHID-OWN-1111"]}
按所有者搜索: {"owners":["PHID-USER-1111"]}
按名称搜索: {"name":"软件包名称"}
按仓库搜索: {"repositories":["PHID-REPO-1111"]}
按路径搜索: {"paths":["src/path/to/file"]}
按状态搜索: {"statuses":["active","archived"]}
全文搜索: {"query":"搜索关键词"}

【attachments 附加信息】
获取路径信息: {"paths":true}

【order 排序选项】
name: 名称（按字母顺序）
newest: 创建日期（最新的优先）
oldest: 创建日期（最旧的优先）
relevance: 相关性

【使用场景】
- 查找所有软件包的所有者
- 搜索特定用户拥有的软件包
- 按名称筛选软件包
- 按仓库筛选软件包
- 按路径筛选软件包
- 获取软件包的路径信息
- 按状态筛选软件包

【示例】
查找所有软件包:
{"queryKey":"all"}

搜索拥有的软件包:
{"queryKey":"authority"}

搜索活跃的软件包:
{"queryKey":"active"}

搜索特定ID的软件包:
{"constraints":{"ids":[123,456]}}

按所有者搜索:
{"constraints":{"owners":["PHID-USER-1111"]}}

按名称搜索软件包:
{"constraints":{"name":"软件包名称"}}

按仓库搜索:
{"constraints":{"repositories":["PHID-REPO-1111"]}}

按路径搜索:
{"constraints":{"paths":["src/path/to/file"]}}

按状态搜索活跃软件包:
{"constraints":{"statuses":["active"]}}

全文搜索:
{"constraints":{"query":"关键词"}}

获取软件包和路径信息:
{"queryKey":"all","attachments":{"paths":true}}

组合查询:
{"queryKey":"active","constraints":{"name":"软件包名称","owners":["PHID-USER-1111"]},"attachments":{"paths":true},"order":"newest","limit":50}

【返回字段说明】
name: 软件包名称
description: 软件包描述
status: 软件包状态（active/archived）
owners: 所有者列表
policy: 权限策略信息

【注意事项】
- queryKey 默认为 all（全部软件包）
- constraints 必须为JSON对象格式
- attachments 会增加查询时间和数据量
- 最多返回100个结果，可通过limit调整
- 支持分页查询（使用before/after参数）
- owners 字段包含所有者详细信息`
      }
    },
  },
  'packages.package.edit': {
    label: '软件包编辑',
    params: {
      objectIdentifier: { type: 'string', default: '', placeholder: '软件包PHID或ID，留空创建新软件包' },
      transactions: { type: 'json', default: '[{"type":"name","value":"软件包名称"}]', placeholder: '见下方常用操作示例' },
      _help: { 
        type: 'static',
        content: `软件包编辑使用指南:

【基本操作】
设置名称: [{"type":"name","value":"软件包名称"}]
修改查看权限: [{"type":"view","value":"PHID-PROJ-1111"}]
修改编辑权限: [{"type":"edit","value":"PHID-PROJ-1111"}]

【项目管理】
添加项目标签: [{"type":"projects.add","value":["PHID-PROJ-1111"]}]
移除项目标签: [{"type":"projects.remove","value":["PHID-PROJ-1111"]}]
设置项目标签: [{"type":"projects.set","value":["PHID-PROJ-1111","PHID-PROJ-2222"]}]

【订阅者管理】
添加订阅者: [{"type":"subscribers.add","value":["PHID-USER-1111"]}]
移除订阅者: [{"type":"subscribers.remove","value":["PHID-USER-1111"]}]
设置订阅者: [{"type":"subscribers.set","value":["PHID-USER-1111","PHID-USER-2222"]}]

【权限管理】
修改查看权限: [{"type":"view","value":"PHID-PROJ-1111"}]
修改编辑权限: [{"type":"edit","value":"PHID-PROJ-1111"}]
设置为公开查看: [{"type":"view","value":"public"}]
设置为仅管理员查看: [{"type":"view","value":"admin"}]
设置为公开编辑: [{"type":"edit","value":"public"}]
设置为仅管理员编辑: [{"type":"edit","value":"admin"}]

【批量操作示例】
创建新软件包:
[{"type":"name","value":"我的软件包"}]

设置软件包名称和权限:
[{"type":"name","value":"官方软件包"},{"type":"view","value":"PHID-PROJ-1111"},{"type":"edit","value":"PHID-PROJ-1111"}]

添加项目标签和订阅者:
[{"type":"projects.add","value":["PHID-PROJ-1111"]},{"type":"subscribers.add","value":["PHID-USER-2222"]}]

设置多个项目标签:
[{"type":"projects.set","value":["PHID-PROJ-1111","PHID-PROJ-2222","PHID-PROJ-3333"]}]

移除特定项目标签:
[{"type":"projects.remove","value":["PHID-PROJ-1111"]}]

设置订阅者列表:
[{"type":"subscribers.set","value":["PHID-USER-1111","PHID-USER-2222","PHID-USER-3333"]}]

【组合操作】
创建软件包并添加项目标签:
[{"type":"name","value":"技术团队软件包"},{"type":"projects.add","value":["PHID-PROJ-1111"]}]

修改软件包名称和权限:
[{"type":"name","value":"新软件包名称"},{"type":"view","value":"PHID-PROJ-2222"},{"type":"edit","value":"PHID-PROJ-2222"]}]

重置项目标签并添加订阅者:
[{"type":"projects.set","value":["PHID-PROJ-1111"]},{"type":"subscribers.add","value":["PHID-USER-2222"]}]

完整的软件包创建:
[{"type":"name","value":"官方软件包"},{"type":"view","value":"PHID-PROJ-1111"},{"type":"edit","value":"PHID-PROJ-2222"},{"type":"projects.add","value":["PHID-PROJ-3333"]},{"type":"subscribers.add","value":["PHID-USER-4444"]}]

【注意事项】
- objectIdentifier 为空时创建新软件包
- transactions 必须为JSON数组格式
- 每个事务包含 type 和 value 字段
- name 事务用于设置软件包名称
- view 事务用于修改查看权限
- edit 事务用于修改编辑权限
- 项目标签和订阅者都需要有效的PHID
- projects.set 会覆盖现有的所有项目标签
- subscribers.set 会覆盖现有的所有订阅者
- 权限设置需要有效的PHID或常量值
- 可以在一个操作中执行多个事务`
      }
    },
  },
  'packages.package.search': {
    label: '软件包搜索',
    params: {
      queryKey: { type: 'string', default: 'all', placeholder: '查询类型：all' },
      constraints: { type: 'json', default: '{}', placeholder: '约束条件，见下方常用示例' },
      attachments: { type: 'json', default: '{}', placeholder: '附加信息，如：{"subscribers":true}' },
      order: { type: 'string', default: 'newest', placeholder: '排序：newest/oldest' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制，默认100' },
      _help: { 
        type: 'static',
        content: `软件包搜索使用指南:

【queryKey 查询类型】
all: 全部软件包

【常用约束条件】
按ID搜索: {"ids":[123,456]}
按PHID搜索: {"phids":["PHID-PKG-1111"]}
按名称搜索: {"match":"软件包名称"}
按发布者搜索: {"publisherPHIDs":["PHID-PUBL-1111"]}
按订阅者搜索: {"subscribers":["PHID-USER-1111"]}
按项目标签搜索: {"projects":["PHID-PROJ-1111"]}

【attachments 附加信息】
获取订阅者信息: {"subscribers":true}
获取项目信息: {"projects":true}
组合获取: {"subscribers":true,"projects":true}

【order 排序选项】
newest: 创建日期（最新的优先）
oldest: 创建日期（最旧的优先）

【使用场景】
- 查找所有软件包
- 搜索特定名称的软件包
- 按发布者筛选软件包
- 按项目标签筛选软件包
- 获取软件包的订阅者信息
- 按创建时间排序软件包

【示例】
查找所有软件包:
{"queryKey":"all"}

搜索特定ID的软件包:
{"constraints":{"ids":[123,456]}}

按名称搜索软件包:
{"constraints":{"match":"软件包名称"}}

按发布者搜索:
{"constraints":{"publisherPHIDs":["PHID-PUBL-1111"]}}

按项目标签搜索:
{"constraints":{"projects":["PHID-PROJ-1111"]}}

获取软件包和订阅者信息:
{"queryKey":"all","attachments":{"subscribers":true}}

组合查询:
{"queryKey":"all","constraints":{"match":"软件包名称","publisherPHIDs":["PHID-PUBL-1111"]},"attachments":{"subscribers":true,"projects":true},"order":"newest","limit":50}

【返回字段说明】
name: 软件包名称
packageKey: 软件包唯一标识符
dateCreated: 创建时间戳
dateModified: 修改时间戳
policy: 权限策略信息

【注意事项】
- queryKey 默认为 all（全部软件包）
- constraints 必须为JSON对象格式
- attachments 会增加查询时间和数据量
- 最多返回100个结果，可通过limit调整
- 支持分页查询（使用before/after参数）`
      }
    },
  },
  'packages.publisher.search': {
    label: '软件包发布者搜索',
    params: {
      queryKey: { type: 'string', default: 'all', placeholder: '查询类型：all' },
      constraints: { type: 'json', default: '{}', placeholder: '约束条件，见下方常用示例' },
      attachments: { type: 'json', default: '{}', placeholder: '附加信息，如：{"subscribers":true}' },
      order: { type: 'string', default: 'newest', placeholder: '排序：newest/oldest' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制，默认100' },
      _help: { 
        type: 'static',
        content: `软件包发布者搜索使用指南:

【queryKey 查询类型】
all: 全部发布者

【常用约束条件】
按ID搜索: {"ids":[123,456]}
按PHID搜索: {"phids":["PHID-PUBL-1111"]}
按名称搜索: {"match":"发布者名称"}
按订阅者搜索: {"subscribers":["PHID-USER-1111"]}
按项目标签搜索: {"projects":["PHID-PROJ-1111"]}

【attachments 附加信息】
获取订阅者信息: {"subscribers":true}
获取项目信息: {"projects":true}
组合获取: {"subscribers":true,"projects":true}

【order 排序选项】
newest: 创建日期（最新的优先）
oldest: 创建日期（最旧的优先）

【使用场景】
- 查找所有软件包发布者
- 搜索特定名称的发布者
- 按项目标签筛选发布者
- 获取发布者的订阅者信息
- 按创建时间排序发布者

【示例】
查找所有发布者:
{"queryKey":"all"}

搜索特定ID的发布者:
{"constraints":{"ids":[123,456]}}

按名称搜索发布者:
{"constraints":{"match":"发布者名称"}}

按项目标签搜索:
{"constraints":{"projects":["PHID-PROJ-1111"]}}

获取发布者和订阅者信息:
{"queryKey":"all","attachments":{"subscribers":true}}

组合查询:
{"queryKey":"all","constraints":{"match":"发布者名称"},"attachments":{"subscribers":true,"projects":true},"order":"newest","limit":50}

【返回字段说明】
name: 发布者名称
publisherKey: 发布者唯一标识符
dateCreated: 创建时间戳
dateModified: 修改时间戳
policy: 权限策略信息

【注意事项】
- queryKey 默认为 all（全部发布者）
- constraints 必须为JSON对象格式
- attachments 会增加查询时间和数据量
- 最多返回100个结果，可通过limit调整
- 支持分页查询（使用before/after参数）`
      }
    },
  },
  'packages.version.edit': {
    label: '软件包版本编辑',
    params: {
      objectIdentifier: { type: 'string', default: '', placeholder: '版本PHID或ID，留空创建新版本' },
      transactions: { type: 'json', default: '[{"type":"projects.add","value":[]}]', placeholder: '见下方常用操作示例' },
      _help: { 
        type: 'static',
        content: `软件包版本编辑使用指南:

【基本操作】
添加项目标签: [{"type":"projects.add","value":["PHID-PROJ-1111"]}]
移除项目标签: [{"type":"projects.remove","value":["PHID-PROJ-1111"]}]
设置项目标签: [{"type":"projects.set","value":["PHID-PROJ-1111","PHID-PROJ-2222"]}]

【订阅者管理】
添加订阅者: [{"type":"subscribers.add","value":["PHID-USER-1111"]}]
移除订阅者: [{"type":"subscribers.remove","value":["PHID-USER-1111"]}]
设置订阅者: [{"type":"subscribers.set","value":["PHID-USER-1111","PHID-USER-2222"]}]

【项目管理】
添加项目标签: [{"type":"projects.add","value":["PHID-PROJ-1111"]}]
移除项目标签: [{"type":"projects.remove","value":["PHID-PROJ-1111"]}]
设置项目标签: [{"type":"projects.set","value":["PHID-PROJ-1111","PHID-PROJ-2222"]}]

【批量操作示例】
创建新版本并添加项目标签:
[{"type":"projects.add","value":["PHID-PROJ-1111"]}]

设置版本的项目标签和订阅者:
[{"type":"projects.set","value":["PHID-PROJ-1111","PHID-PROJ-2222"]},{"type":"subscribers.add","value":["PHID-USER-1111"]}]

添加多个项目标签:
[{"type":"projects.add","value":["PHID-PROJ-1111","PHID-PROJ-2222","PHID-PROJ-3333"]}]

移除特定项目标签:
[{"type":"projects.remove","value":["PHID-PROJ-1111"]}]

设置订阅者列表:
[{"type":"subscribers.set","value":["PHID-USER-1111","PHID-USER-2222","PHID-USER-3333"]}]

【组合操作】
添加项目标签和订阅者:
[{"type":"projects.add","value":["PHID-PROJ-1111"]},{"type":"subscribers.add","value":["PHID-USER-2222"]}]

重置项目标签并添加订阅者:
[{"type":"projects.set","value":["PHID-PROJ-1111"]},{"type":"subscribers.add","value":["PHID-USER-2222"]}]

【注意事项】
- objectIdentifier 为空时创建新版本
- transactions 必须为JSON数组格式
- 每个事务包含 type 和 value 字段
- 项目标签和订阅者都需要有效的PHID
- projects.set 会覆盖现有的所有项目标签
- subscribers.set 会覆盖现有的所有订阅者
- 可以在一个操作中执行多个事务`
      }
    },
  },
  'packages.version.search': {
    label: '软件包版本搜索',
    params: {
      queryKey: { type: 'string', default: 'all', placeholder: '查询类型：all' },
      constraints: { type: 'json', default: '{}', placeholder: '约束条件，见下方常用示例' },
      attachments: { type: 'json', default: '{}', placeholder: '附加信息，如：{"subscribers":true}' },
      order: { type: 'string', default: 'newest', placeholder: '排序：newest/oldest' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制，默认100' },
      _help: { 
        type: 'static',
        content: `软件包版本搜索使用指南:

【queryKey 查询类型】
all: 全部版本

【常用约束条件】
按ID搜索: {"ids":[123,456]}
按PHID搜索: {"phids":["PHID-PCKV-1111"]}
按名称搜索: {"match":"版本名称"}
按软件包搜索: {"packagePHIDs":["PHID-PACK-1111"]}
按订阅者搜索: {"subscribers":["PHID-USER-1111"]}
按项目标签搜索: {"projects":["PHID-PROJ-1111"]}

【attachments 附加信息】
获取订阅者信息: {"subscribers":true}
获取项目信息: {"projects":true}
组合获取: {"subscribers":true,"projects":true}

【order 排序选项】
newest: 创建日期（最新的优先）
oldest: 创建日期（最旧的优先）

【使用场景】
- 查找所有软件包版本
- 搜索特定软件包的版本
- 按名称筛选版本
- 获取版本的订阅者信息
- 按创建时间排序版本

【示例】
查找所有版本:
{"queryKey":"all"}

搜索特定ID的版本:
{"constraints":{"ids":[123,456]}}

按名称搜索版本:
{"constraints":{"match":"v1.0.0"}}

按软件包搜索版本:
{"constraints":{"packagePHIDs":["PHID-PACK-1111"]}}

按项目标签搜索:
{"constraints":{"projects":["PHID-PROJ-1111"]}}

获取版本和订阅者信息:
{"queryKey":"all","attachments":{"subscribers":true}}

组合查询:
{"queryKey":"all","constraints":{"packagePHIDs":["PHID-PACK-1111"]},"attachments":{"subscribers":true,"projects":true},"order":"newest","limit":50}

【返回字段说明】
name: 版本名称
dateCreated: 创建时间戳
dateModified: 修改时间戳
policy: 权限策略信息

【注意事项】
- queryKey 默认为 all（全部版本）
- constraints 必须为JSON对象格式
- attachments 会增加查询时间和数据量
- 最多返回100个结果，可通过limit调整
- 支持分页查询（使用before/after参数）`
      }
    },
  },
  'phame.blog.search': {
    label: '博客搜索',
    params: {
      queryKey: { type: 'string', default: 'active', placeholder: '查询类型：active/archived/all' },
      constraints: { type: 'json', default: '{}', placeholder: '约束条件，见下方常用示例' },
      attachments: { type: 'json', default: '{}', placeholder: '附加信息，如：{"subscribers":true}' },
      order: { type: 'string', default: 'newest', placeholder: '排序：newest/oldest/relevance' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制，默认100' },
      _help: { 
        type: 'static',
        content: `博客搜索使用指南:

【queryKey 查询类型】
active: 激活的博客
archived: 归档的博客
all: 全部博客

【常用约束条件】
按ID搜索: {"ids":[123,456]}
按PHID搜索: {"phids":["PHID-BLOG-1111"]}
按订阅者搜索: {"subscribers":["PHID-USER-1111"]}
按项目标签搜索: {"projects":["PHID-PROJ-1111"]}
全文搜索: {"query":"技术博客"}
按可见策略团队搜索: {"viewPolicyTeams":["team1","team2"]}
按编辑策略团队搜索: {"editPolicyTeams":["team1","team2"]}

【attachments 附加信息】
获取订阅者信息: {"subscribers":true}
获取项目信息: {"projects":true}
组合获取: {"subscribers":true,"projects":true}

【order 排序选项】
newest: 创建日期（最新的优先）
oldest: 创建日期（最旧的优先）
relevance: 相关性排序

【使用场景】
- 查找所有激活的博客
- 搜索特定用户的博客
- 按项目标签筛选博客
- 获取博客的订阅者信息
- 按创建时间排序博客

【示例】
查找激活的博客:
{"queryKey":"active"}

搜索特定用户的博客:
{"constraints":{"subscribers":["PHID-USER-1111"]}}

按项目标签搜索:
{"constraints":{"projects":["PHID-PROJ-1111"]}}

全文搜索:
{"constraints":{"query":"技术博客"},"order":"relevance"}

获取博客和订阅者信息:
{"queryKey":"all","attachments":{"subscribers":true}}

组合查询:
{"queryKey":"active","constraints":{"projects":["PHID-PROJ-1111"]},"attachments":{"subscribers":true,"projects":true},"order":"newest","limit":50}

【返回字段说明】
name: 博客名称
description: 博客描述
status: 状态（active/archived）
dateCreated: 创建时间戳
dateModified: 修改时间戳
policy: 权限策略信息

【注意事项】
- queryKey 默认为 active（激活博客）
- constraints 必须为JSON对象格式
- attachments 会增加查询时间和数据量
- 最多返回100个结果，可通过limit调整
- 支持分页查询（使用before/after参数）`
      }
    },
  },
  'phame.blog.edit': {
    label: '博客编辑',
    params: {
      objectIdentifier: { type: 'string', default: '', placeholder: '博客PHID或ID，留空创建新博客' },
      transactions: { type: 'json', default: '[{"type":"name","value":"博客名称"}]', placeholder: '见下方常用操作示例' },
      _help: { 
        type: 'static',
        content: `博客编辑使用指南:

【基本操作】
设置博客名称: [{"type":"name","value":"我的技术博客"}]
设置副标题: [{"type":"subtitle","value":"副标题内容"}]
设置描述: [{"type":"description","value":"博客描述信息"}]
设置域名: [{"type":"domainFullURI","value":"https://blog.example.com"}]

【站点配置】
设置父站点: [{"type":"parentSite","value":"主站点名称"}]
设置父域名: [{"type":"parentDomain","value":"example.com"}]
设置状态: [{"type":"status","value":"active"}] 或 [{"type":"status","value":"archived"}]

【权限管理】
修改查看权限: [{"type":"view","value":"PHID-PROJ-1111"}]
修改编辑权限: [{"type":"edit","value":"PHID-USER-1111"}]

【项目管理】
添加项目标签: [{"type":"projects.add","value":["PHID-PROJ-1111"]}]
移除项目标签: [{"type":"projects.remove","value":["PHID-PROJ-1111"]}]
设置项目标签: [{"type":"projects.set","value":["PHID-PROJ-1111","PHID-PROJ-2222"]}]

【订阅管理】
添加订阅者: [{"type":"subscribers.add","value":["PHID-USER-1111"]}]
移除订阅者: [{"type":"subscribers.remove","value":["PHID-USER-1111"]}]
设置订阅者: [{"type":"subscribers.set","value":["PHID-USER-1111","PHID-USER-2222"]}]

【状态选项】
active: 激活状态
archived: 归档状态

【批量操作示例】
创建新博客并设置基本信息:
[{"type":"name","value":"技术博客"},{"type":"subtitle","value":"分享技术心得"},{"type":"description","value":"专注于前端开发"}]

设置博客域名和权限:
[{"type":"domainFullURI","value":"https://tech.example.com"},{"type":"view","value":"public"},{"type":"edit","value":"PHID-USER-1234"}]

添加项目和订阅者:
[{"type":"projects.add","value":["PHID-PROJ-1111"]},{"type":"subscribers.add","value":["PHID-USER-2222"]}]

【注意事项】
- objectIdentifier 为空时创建新博客
- transactions 必须为JSON数组格式
- 每个事务包含 type 和 value 字段
- 权限设置需要有效的PHID或常量值
- 域名设置需要完整的URI格式`
      }
    },
  },
  'phriction.create': {
    label: 'Wiki文档创建',
    params: {
      slug: { type: 'string', default: '', placeholder: '文档路径，如：documentation/guide' },
      title: { type: 'string', default: '', placeholder: '文档标题（必需）' },
      content: { type: 'string', default: '', placeholder: '文档内容（必需）' },
      description: { type: 'string', default: '', placeholder: '文档描述（可选）' },
      _help: { 
        type: 'static',
        content: `Wiki文档创建使用指南:

【slug 参数说明】
slug 是Wiki文档的唯一路径标识符，用于定位新创建的文档。
此路径将成为文档的访问地址。

【常用路径格式】
根页面: "" 或 "/"
子页面: "documentation/guide"
深层页面: "projects/web/api/reference"
中文页面: "用户手册/快速开始"

【title 参数】
- 文档标题（必需参数）
- 将显示在页面标题和导航中
- 支持中英文字符
- 建议简洁明了，体现文档主题

【content 参数】
- 文档主要内容（必需参数）
- 支持Remarkup格式（Phabricator的标记语言）
- 可包含链接、标题、列表、代码块等
- 这是文档的核心内容

【description 参数】
- 文档描述或摘要（可选参数）
- 用于SEO和文档预览
- 帮助用户快速了解文档内容
- 建议控制在200字符以内

【Remarkup 常用语法】
== 标题 == 
=== 子标题 ===
* 列表项
**粗体文本**
*斜体文本*
[[链接|显示文本]]
{{代码块}}
> 引用文本

【使用场景】
- 创建项目文档
- 建立知识库
- 编写技术规范
- 制作用户手册
- 记录会议纪要

【示例】
创建简单文档:
{"slug":"guide/intro","title":"入门指南","content":"欢迎使用本系统"}

创建技术文档:
{"slug":"api/overview","title":"API概览","content":"== 接口说明 ==\\n\\n本文档介绍系统API接口"}

创建带描述的文档:
{"slug":"project/readme","title":"项目说明","content":"== 项目介绍 ==\\n\\n这是一个示例项目","description":"项目的基本信息和使用说明"}

创建中文文档:
{"slug":"用户手册/安装","title":"安装指南","content":"=== 安装步骤 ===\\n\\n1. 下载软件\\n2. 运行安装程序"}

【注意事项】
- slug 参数是必需的，不能为空
- title 和 content 参数都是必需的
- 如果指定路径的文档已存在，会返回错误
- 路径使用正斜杠(/)分隔层级
- 内容支持完整的Remarkup语法
- 创建成功后会自动生成版本历史记录`
      }
    },
  },
  'phriction.edit': {
    label: 'Wiki文档编辑',
    params: {
      slug: { type: 'string', default: '', placeholder: '文档路径，如：documentation/guide' },
      title: { type: 'string', default: '', placeholder: '文档标题，留空保持不变' },
      content: { type: 'string', default: '', placeholder: '文档内容，支持Remarkup格式' },
      description: { type: 'string', default: '', placeholder: '文档描述，留空保持不变' },
      _help: { 
        type: 'static',
        content: `Wiki文档编辑使用指南:

【slug 参数说明】
slug 是Wiki文档的唯一路径标识符，用于定位要编辑的文档。
如果文档不存在，会自动创建新文档。

【常用路径格式】
根页面: "" 或 "/"
子页面: "documentation/guide"
深层页面: "projects/web/api/reference"
中文页面: "用户手册/快速开始"

【title 参数】
- 文档标题
- 留空则保持原标题不变
- 创建新文档时建议设置标题
- 支持中英文字符

【content 参数】
- 文档主要内容
- 支持Remarkup格式（Phabricator的标记语言）
- 留空则保持原内容不变
- 可包含链接、标题、列表、代码块等

【description 参数】
- 文档描述或摘要
- 留空则保持原描述不变
- 用于SEO和文档预览
- 建议简洁明了

【Remarkup 常用语法】
== 标题 == 
=== 子标题 ===
* 列表项
**粗体文本**
*斜体文本*
[[链接|显示文本]]
{{代码块}}
> 引用文本

【使用场景】
- 创建新的Wiki文档
- 更新现有文档内容
- 修改文档标题和描述
- 批量更新文档结构

【示例】
创建新文档:
{"slug":"new/guide","title":"新指南","content":"这是新文档的内容"}

更新现有文档:
{"slug":"documentation/guide","content":"== 更新内容 ==\\n\\n新的文档内容"}

修改标题和内容:
{"slug":"api/reference","title":"API参考文档","content":"=== 概述 ===\\n\\nAPI接口说明"}

仅修改描述:
{"slug":"project/overview","description":"项目概述和目标"}

【注意事项】
- slug 参数是必需的，不能为空
- 如果文档不存在，会自动创建
- 只有非空参数才会更新对应字段
- 内容支持完整的Remarkup语法
- 编辑会创建新的版本历史记录`
      }
    },
  },
  'phriction.history': {
    label: 'Wiki文档历史',
    params: {
      slug: { type: 'string', default: '', placeholder: '文档路径，如：documentation/guide' },
      _help: { 
        type: 'static',
        content: `Wiki文档历史查询指南:

【slug 参数说明】
slug 是Wiki文档的唯一路径标识符，用于查询特定文档的编辑历史记录。

【常用路径格式】
根页面: "" 或 "/"
子页面: "documentation/guide"
深层页面: "projects/web/api/reference"
中文页面: "用户手册/快速开始"

【路径规则】
- 使用正斜杠(/)分隔层级
- 不以斜杠开头或结尾
- 支持中英文字符
- 路径区分大小写
- 空字符串表示根页面

【返回历史信息包含】
- 每次编辑的版本信息
- 编辑时间和作者
- 编辑类型（创建、修改、删除等）
- 版本描述和变更摘要
- 文档内容快照

【历史记录类型】
- 创建文档的初始版本
- 内容修改的编辑版本
- 标题和属性变更
- 文档删除和恢复操作

【使用场景】
- 查看文档的完整编辑历史
- 追踪特定用户的编辑活动
- 查看文档的变更时间线
- 恢复文档的历史版本
- 分析文档的编辑频率

【示例】
查询根页面历史:
{"slug":""}

查询文档指南历史:
{"slug":"documentation/guide"}

查询API参考历史:
{"slug":"projects/web/api/reference"}

查询中文手册历史:
{"slug":"用户手册/快速开始"}

【注意事项】
- 如果文档不存在，会返回 ERR-BAD-DOCUMENT 错误
- slug 参数是必需的，不能为空
- 历史记录按时间倒序排列（最新的在前）
- 每个版本都包含完整的元数据信息`
      }
    },
  },
  'phriction.info': {
    label: 'Wiki文档信息',
    params: {
      slug: { type: 'string', default: '', placeholder: '文档路径，如：documentation/guide' },
      _help: { 
        type: 'static',
        content: `Wiki文档信息查询指南:

【slug 参数说明】
slug 是Wiki文档的唯一路径标识符，用于定位特定的文档页面。

【常用路径格式】
根页面: "" 或 "/"
子页面: "documentation/guide"
深层页面: "projects/web/api/reference"
中文页面: "用户手册/快速开始"

【路径规则】
- 使用正斜杠(/)分隔层级
- 不以斜杠开头或结尾
- 支持中英文字符
- 路径区分大小写
- 空字符串表示根页面

【返回信息包含】
- 文档标题和内容
- 创建和修改时间
- 作者信息
- 文档PHID
- 权限设置
- 子文档列表

【使用场景】
- 获取特定Wiki页面的详细信息
- 检查文档是否存在
- 获取文档的元数据信息
- 查看文档的层级结构

【示例】
查询根页面:
{"slug":""}

查询文档指南:
{"slug":"documentation/guide"}

查询API参考:
{"slug":"projects/web/api/reference"}

查询中文手册:
{"slug":"用户手册/快速开始"}

【注意事项】
- 如果文档不存在，会返回 ERR-BAD-DOCUMENT 错误
- slug 参数是必需的，不能为空
- 确保路径格式正确，避免多余的斜杠`
      }
    },
  },
  'phurls.search': {
    label: 'URL搜索',
    params: {
      queryKey: { type: 'string', default: 'all', placeholder: '内置查询：all/authored' },
      constraints: { type: 'json', default: '{}', placeholder: '搜索约束条件' },
      attachments: { type: 'json', default: '{}', placeholder: '附加信息：subscribers/projects' },
      order: { type: 'string', default: 'newest', placeholder: '排序：newest/oldest' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制' },
      _help: { 
        type: 'static',
        content: `URL搜索使用指南:

【queryKey - 内置查询】
all: 所有URL
authored: 我创建的URL

【constraints - 常用约束】
按ID: {"ids":[123,456]}
按PHID: {"phids":["PHID-PURL-1111"]}
按创建者: {"authorPHIDs":["PHID-USER-1111"]}
按名称包含: {"name":"关键词"}
按别名: {"aliases":["myalias"]}
按原始URL: {"longurls":["https://example.com"]}
按订阅者: {"subscribers":["PHID-USER-1111"]}
按项目标签: {"projects":["PHID-PROJ-1111"]}
按空间: {"spaces":["PHID-SPCE-1111"]}

【attachments - 附加信息】
{"subscribers":true} - 订阅者信息
{"projects":true} - 项目标签信息
{"subscribers":true,"projects":true} - 多个附加信息

【order - 排序方式】
newest: 创建日期最新优先
oldest: 创建日期最旧优先

【返回字段说明】
name: URL名称
alias: URL别名
longurl: 原始长URL
description: URL描述
spacePHID: 所属空间PHID
dateCreated: 创建时间戳
dateModified: 修改时间戳
policy: 权限策略映射

【使用场景】
- 查找我创建的所有短链接
- 按别名搜索特定URL
- 查找特定项目的所有链接
- 获取包含特定域名的URL

【示例】
搜索我创建的所有URL:
{"queryKey":"authored"}

按别名搜索:
{"constraints":{"aliases":["myalias"]}}

搜索特定项目的URL并获取项目信息:
{"constraints":{"projects":["PHID-PROJ-1111"]},"attachments":{"projects":true}}

按名称搜索并获取订阅者信息:
{"constraints":{"name":"关键词"},"attachments":{"subscribers":true}}`
      }
    },
  },
  'phurls.edit': {
    label: 'URL编辑',
    params: {
      objectIdentifier: { type: 'string', default: '', placeholder: 'URL PHID或ID，留空创建新URL' },
      transactions: { 
        type: 'json', 
        default: '[{"type":"url","value":"https://example.com"}]',
        placeholder: '见下方常用操作示例'
      },
      _help: { 
        type: 'static',
        content: `URL编辑使用指南:

【基本操作】
创建新URL: [{"type":"url","value":"https://example.com"}]
设置URL名称: [{"type":"name","value":"链接名称"}]
设置别名: [{"type":"alias","value":"myalias"}]
设置描述: [{"type":"description","value":"URL详细描述"}]

【项目管理】
添加项目标签: [{"type":"projects.add","value":["PHID-PROJ-1111"]}]
移除项目标签: [{"type":"projects.remove","value":["PHID-PROJ-1111"]}]
设置项目标签: [{"type":"projects.set","value":["PHID-PROJ-1111","PHID-PROJ-2222"]}]

【订阅管理】
添加订阅者: [{"type":"subscribers.add","value":["PHID-USER-1111"]}]
移除订阅者: [{"type":"subscribers.remove","value":["PHID-USER-1111"]}]
设置订阅者: [{"type":"subscribers.set","value":["PHID-USER-1111","PHID-USER-2222"]}]

【权限管理】
修改查看权限: [{"type":"view","value":"PHID-PROJ-1111"}]
修改编辑权限: [{"type":"edit","value":"PHID-USER-1111"}]
切换空间: [{"type":"space","value":"PHID-SPCE-1111"}]

【评论操作】
添加评论: [{"type":"comment","value":"这是一个评论内容"}]

【批量操作示例】
创建新URL并设置名称和描述:
[{"type":"url","value":"https://example.com"},{"type":"name","value":"示例网站"},{"type":"description","value":"这是一个示例网站"}]

创建URL并添加到项目:
[{"type":"url","value":"https://example.com"},{"type":"projects.add","value":["PHID-PROJ-1111"]}]

修改现有URL并添加订阅者:
[{"type":"name","value":"新名称"},{"type":"subscribers.add","value":["PHID-USER-1111"]}]`
      }
    },
  },
  'maniphest.status.search': {
    label: '任务状态搜索',
    params: {
      _help: { 
        type: 'static',
        content: `任务状态搜索使用指南:

【API功能】
返回 Maniphest 任务可能的完整状态信息列表。

【参数说明】
此API不需要任何参数，直接调用即可返回所有可用的任务状态。

【返回信息包含】
- 状态名称和标识符
- 状态的显示名称
- 状态的完整描述
- 状态的类型分类
- 状态的优先级信息
- 状态的使用说明

【常见状态类型】
- 开放状态：如 open、needs triage
- 关闭状态：如 resolved、duplicate、invalid
- 暂停状态：如 hold
- 其他自定义状态

【使用场景】
- 获取系统中所有可用的任务状态
- 了解状态之间的转换关系
- 为任务创建或编辑提供状态选项
- 验证状态名称的有效性
- 构建状态选择界面

【调用示例】
直接调用:
{}

【返回示例】
{
  "result": {
    "open": {
      "name": "open",
      "value": "开放",
      "color": "red",
      "special": "default"
    },
    "resolved": {
      "name": "resolved", 
      "value": "已解决",
      "color": "green",
      "special": "closed"
    },
    "duplicate": {
      "name": "duplicate",
      "value": "重复", 
      "color": "orange",
      "special": "duplicate"
    }
  }
}

【注意事项】
- 此API不需要任何参数
- 返回的状态列表包含系统所有可用状态
- 状态信息包含名称、显示值、颜色等属性
- 可用于任务创建、编辑和查询操作
- 状态配置可能因系统而异`
      }
    },
  },
  'project.edit': {
    label: '项目编辑',
    params: {
      objectIdentifier: { type: 'string', default: '', placeholder: '项目PHID或名称，留空创建新项目' },
      transactions: { 
        type: 'json', 
        default: '[{"type":"name","value":"新项目名称"}]',
        placeholder: '见下方常用操作示例'
      },
      _help: { 
        type: 'static',
        content: `常用操作示例:
重命名: [{"type":"name","value":"新项目名称"}]
修改描述: [{"type":"description","value":"项目描述"}]
修改颜色: [{"type":"color","value":"red"}]
修改图标: [{"type":"icon","value":"fa-briefcase"}]
添加成员: [{"type":"members.add","value":["PHID-USER-1111"]}]
移除成员: [{"type":"members.remove","value":["PHID-USER-1111"]}]
设置项目经理: [{"type":"projectManagerPHID","value":"PHID-USER-1111"}]
设置产品经理: [{"type":"productManagerPHID","value":"PHID-USER-1111"}]
批量操作: [{"type":"name","value":"新名称"},{"type":"color","value":"blue"}]
更多事务类型请查看 Phabricator 文档`
      }
    },
  },
  'maniphest.priority.search': {
    label: '任务优先级搜索',
    params: {
      _help: { 
        type: 'static',
        content: `任务优先级搜索使用指南:

【API功能】
返回Maniphest任务的所有可用优先级信息。

【参数说明】
此API不需要任何参数。

【返回信息】
返回一个包含所有优先级信息的映射，每个优先级包含：
- key: 优先级键值
- name: 优先级名称
- color: 优先级颜色
- special: 特殊标记（如default、closed等）

【使用场景】
- 获取系统中所有可用的任务优先级
- 了解优先级的配置和属性
- 为任务创建和编辑提供优先级选项
- 分析任务优先级分布

【调用示例】
直接调用，无需参数:
{}

【返回示例】
{
  "90": {
    "key": "90",
    "name": "Needs Triage",
    "color": "violet",
    "special": "needs-triage"
  },
  "80": {
    "key": "80", 
    "name": "High",
    "color": "red",
    "special": null
  },
  "50": {
    "key": "50",
    "name": "Normal", 
    "color": "grey",
    "special": "default"
  },
  "25": {
    "key": "25",
    "name": "Low",
    "color": "sky", 
    "special": null
  },
  "0": {
    "key": "0",
    "name": "Wishlist",
    "color": "blue",
    "special": null
  }
}

【优先级说明】
90: 需要分类（Needs Triage）
80: 高优先级（High）
50: 普通优先级（Normal，默认）
25: 低优先级（Low）
0: 愿望清单（Wishlist）

【注意事项】
- 此API不需要任何参数
- 返回的优先级列表包含系统所有可用优先级
- 优先级数值越高表示优先级越高
- special字段标记特殊用途的优先级
- 优先级配置可能因系统而异
- 可用于任务创建、编辑和查询操作
- OAuth客户端始终可以调用此方法`
      }
    },
  },
  'maniphest.pre.edit': {
    label: '任务预编辑',
    params: {
      parent: { type: 'string', default: '', placeholder: '父任务PHID（可选）' },
      column: { type: 'json', default: '[]', placeholder: '工作栏PHID列表（可选）' },
      space: { type: 'string', default: '', placeholder: '空间PHID（必需）' },
      subtype: { type: 'string', default: 'default', placeholder: '任务子类型（必需）' },
      comment: { type: 'string', default: '', placeholder: '评论内容（可选）' },
      title: { type: 'string', default: '', placeholder: '任务标题（必需）' },
      owner: { type: 'string', default: '', placeholder: '负责人PHID（可选）' },
      status: { type: 'string', default: 'open', placeholder: '任务状态（必需）' },
      priority: { type: 'string', default: '50', placeholder: '优先级（必需）' },
      description: { type: 'string', default: '', placeholder: '任务描述（可选）' },
      'parents.add': { type: 'json', default: '[]', placeholder: '添加父任务PHID列表（可选）' },
      'parents.remove': { type: 'json', default: '[]', placeholder: '移除父任务PHID列表（可选）' },
      'parents.set': { type: 'json', default: '[]', placeholder: '设置父任务PHID列表（可选）' },
      'subtasks.add': { type: 'json', default: '[]', placeholder: '添加子任务PHID列表（可选）' },
      'subtasks.remove': { type: 'json', default: '[]', placeholder: '移除子任务PHID列表（可选）' },
      'subtasks.set': { type: 'json', default: '[]', placeholder: '设置子任务PHID列表（可选）' },
      view: { type: 'string', default: '', placeholder: '查看权限（必需）' },
      edit: { type: 'string', default: '', placeholder: '编辑权限（必需）' },
      'projects.add': { type: 'json', default: '[]', placeholder: '添加项目列表（可选）' },
      'projects.remove': { type: 'json', default: '[]', placeholder: '移除项目列表（可选）' },
      'projects.set': { type: 'json', default: '[]', placeholder: '设置项目列表（可选）' },
      'subscribers.add': { type: 'json', default: '[]', placeholder: '添加订阅者列表（可选）' },
      'subscribers.remove': { type: 'json', default: '[]', placeholder: '移除订阅者列表（可选）' },
      'subscribers.set': { type: 'json', default: '[]', placeholder: '设置订阅者列表（可选）' },
      'custom.mycompany.task-category': { type: 'string', default: '', placeholder: '任务分类（可选）' },
      'custom.mycompany.actural-time': { type: 'string', default: '', placeholder: '实际时间（可选）' },
      'custom.mycompany.DeliveryLink': { type: 'string', default: '', placeholder: '交付链接（可选）' },
      'custom.tp-link.estimated-days': { type: 'string', default: '', placeholder: '预估天数（可选）' },
      'custom.tp-link.estimated-date-complete': { type: 'string', default: '', placeholder: '预估完成日期（可选）' },
      'custom.tp-link.update-datedelay-times': { type: 'string', default: '', placeholder: '延期次数（可选）' },
      'custom.tp-link.delay-type': { type: 'json', default: '[]', placeholder: '延期类型列表（可选）' },
      'custom.tp-link.update-date-complete-instruction': { type: 'string', default: '', placeholder: '完成日期更新说明（可选）' },
      'custom.tp-link.work-class': { type: 'string', default: '', placeholder: '工作类别（必需）' },
      'custom.tp-link.work-score': { type: 'string', default: '', placeholder: '工作评分（必需）' },
      'custom.tp-link.complete-rate': { type: 'string', default: '', placeholder: '完成率（必需）' },
      'custom.tp-link.estimated-date-restart': { type: 'string', default: '', placeholder: '预估重启日期（可选）' },
      'custom.tp-link.reason-of-pause': { type: 'string', default: '', placeholder: '暂停原因（可选）' },
      'custom.tp-link.work-quality-evaluation': { type: 'string', default: '', placeholder: '工作质量评估（可选）' },
      'custom.tp-link.work-efficiency-evaluation': { type: 'string', default: '', placeholder: '工作效率评估（可选）' },
      objectIdentifier: { type: 'string', default: '', placeholder: '任务ID或PHID，留空创建新任务（可选）' },
      _help: { 
        type: 'static',
        content: `任务预编辑使用指南:

【API功能】
以人类可读的方式创建新任务或编辑现有任务。

【必需参数】
- space: 空间PHID
- subtype: 任务子类型
- title: 任务标题
- status: 任务状态
- priority: 优先级
- view: 查看权限
- edit: 编辑权限
- custom.tp-link.work-class: 工作类别
- custom.tp-link.work-score: 工作评分
- custom.tp-link.complete-rate: 完成率

【可选参数】
- parent: 父任务PHID
- column: 工作栏PHID列表
- comment: 评论内容
- owner: 负责人PHID
- description: 任务描述
- parents.add/remove/set: 父任务管理
- subtasks.add/remove/set: 子任务管理
- projects.add/remove/set: 项目管理
- subscribers.add/remove/set: 订阅者管理
- 各种自定义字段

【自定义字段说明】
custom.mycompany.task-category: 任务分类
custom.mycompany.actural-time: 实际时间
custom.mycompany.DeliveryLink: 交付链接
custom.tp-link.estimated-days: 预估天数
custom.tp-link.estimated-date-complete: 预估完成日期
custom.tp-link.update-datedelay-times: 延期次数
custom.tp-link.delay-type: 延期类型列表
custom.tp-link.update-date-complete-instruction: 完成日期更新说明
custom.tp-link.estimated-date-restart: 预估重启日期
custom.tp-link.reason-of-pause: 暂停原因
custom.tp-link.work-quality-evaluation: 工作质量评估
custom.tp-link.work-efficiency-evaluation: 工作效率评估

【使用场景】
- 创建新任务
- 编辑现有任务
- 设置任务属性和权限
- 管理任务层级关系
- 管理项目和订阅者
- 设置自定义字段

【创建新任务示例】
{
  "title": "新任务标题",
  "description": "任务描述",
  "priority": "50",
  "status": "open",
  "space": "PHID-SPACE-1111",
  "subtype": "default",
  "view": "public",
  "edit": "admin",
  "custom.tp-link.work-class": "开发",
  "custom.tp-link.work-score": "5",
  "custom.tp-link.complete-rate": "0%"
}

【编辑现有任务示例】
{
  "objectIdentifier": "T123",
  "title": "更新后的标题",
  "priority": "80",
  "owner": "PHID-USER-1111",
  "custom.tp-link.complete-rate": "50%"
}

【项目管理示例】
{
  "objectIdentifier": "T123",
  "projects.add": ["PHID-PROJ-1111", "PHID-PROJ-2222"],
  "projects.remove": ["PHID-PROJ-3333"]
}

【父子任务管理示例】
{
  "objectIdentifier": "T123",
  "parents.add": ["PHID-TASK-1111"],
  "subtasks.add": ["PHID-TASK-2222", "PHID-TASK-3333"]
}

【注意事项】
- objectIdentifier为空时创建新任务，有值时编辑现有任务
- 必需参数必须提供，否则会报错
- 自定义字段根据系统配置可能有所不同
- OAuth客户端无法调用此方法
- 返回非空字典，包含操作结果
- 支持批量操作，可以同时设置多个属性`
      }
    },
  },
  'maniphest.edit': {
    label: '任务编辑',
    params: {
      transactions: { type: 'json', default: '[]', placeholder: '事务列表，见下方详细说明' },
      objectIdentifier: { type: 'string', default: '', placeholder: '任务ID或PHID，留空创建新任务' },
      _help: { 
        type: 'static',
        content: `任务编辑使用指南:

【API功能】
标准的ApplicationEditor方法，通过应用事务来创建和修改任务对象。

【参数说明】
- transactions: 事务列表，每个事务包含type和value字段
- objectIdentifier: 任务ID或PHID，留空时创建新任务

【事务类型】
parent: 创建此任务作为另一个任务的子任务
column: 将任务移动到一个或更多任务面板列
space: 在空间之间移动对象
subtype: 更改对象子类型
comment: 添加评论
title: 重命名任务
owner: 重新指派任务
status: 改变任务状态
priority: 改变任务优先级
description: 更新任务详情
parents.add/remove/set: 改变父任务
subtasks.add/remove/set: 改变子任务
view/edit: 更改查看/编辑权限
projects.add/remove/set: 添加/移除/设置项目标签
subscribers.add/remove/set: 添加/移除/设置订阅者
custom.mycompany.*: 自定义字段
custom.tp-link.*: TP-Link自定义字段

【事务格式】
每个事务对象包含:
{
  "type": "事务类型",
  "value": "事务值"
}

【常用事务示例】
设置标题: {"type": "title", "value": "新标题"}
设置描述: {"type": "description", "value": "任务描述"}
设置优先级: {"type": "priority", "value": "80"}
设置状态: {"type": "status", "value": "open"}
设置负责人: {"type": "owner", "value": "PHID-USER-1111"}
添加评论: {"type": "comment", "value": "评论内容"}

【项目管理示例】
添加项目: {"type": "projects.add", "value": ["PHID-PROJ-1111"]}
移除项目: {"type": "projects.remove", "value": ["PHID-PROJ-2222"]}
设置项目: {"type": "projects.set", "value": ["PHID-PROJ-3333"]}

【订阅者管理示例】
添加订阅者: {"type": "subscribers.add", "value": ["PHID-USER-1111"]}
移除订阅者: {"type": "subscribers.remove", "value": ["PHID-USER-2222"]}
设置订阅者: {"type": "subscribers.set", "value": ["PHID-USER-3333"]}

【父子任务管理示例】
设置父任务: {"type": "parent", "value": "PHID-TASK-1111"}
添加父任务: {"type": "parents.add", "value": ["PHID-TASK-1111"]}
移除父任务: {"type": "parents.remove", "value": ["PHID-TASK-2222"]}
设置父任务列表: {"type": "parents.set", "value": ["PHID-TASK-3333"]}

【工作栏列管理示例】
简单移动: {"type": "column", "value": ["PHID-PCOL-1111"]}
复杂移动: {"type": "column", "value": [{"columnPHID": "PHID-PCOL-1111", "beforePHID": "PHID-TASK-2222"}]}

【自定义字段示例】
TP-Link预估天数: {"type": "custom.tp-link.estimated-days", "value": "5"}
TP-Link完成日期: {"type": "custom.tp-link.estimated-date-complete", "value": 1704067200}
TP-Link工作类别: {"type": "custom.tp-link.work-class", "value": "开发"}
TP-Link工作评分: {"type": "custom.tp-link.work-score", "value": "5"}
TP-Link完成率: {"type": "custom.tp-link.complete-rate", "value": "80%"}

【创建新任务示例】
{
  "objectIdentifier": "",
  "transactions": [
    {"type": "title", "value": "新任务标题"},
    {"type": "description", "value": "任务描述"},
    {"type": "priority", "value": "50"},
    {"type": "status", "value": "open"},
    {"type": "space", "value": "PHID-SPACE-1111"},
    {"type": "subtype", "value": "default"},
    {"type": "view", "value": "public"},
    {"type": "edit", "value": "admin"},
    {"type": "custom.tp-link.work-class", "value": "开发"},
    {"type": "custom.tp-link.work-score", "value": "5"},
    {"type": "custom.tp-link.complete-rate", "value": "0%"}
  ]
}

【编辑现有任务示例】
{
  "objectIdentifier": "T123",
  "transactions": [
    {"type": "title", "value": "更新后的标题"},
    {"type": "priority", "value": "80"},
    {"type": "owner", "value": "PHID-USER-1111"},
    {"type": "comment", "value": "更新了任务信息"}
  ]
}

【批量操作示例】
{
  "objectIdentifier": "T123",
  "transactions": [
    {"type": "title", "value": "新标题"},
    {"type": "priority", "value": "80"},
    {"type": "status", "value": "open"},
    {"type": "owner", "value": "PHID-USER-1111"},
    {"type": "projects.add", "value": ["PHID-PROJ-1111", "PHID-PROJ-2222"]},
    {"type": "subscribers.add", "value": ["PHID-USER-2222"]},
    {"type": "custom.tp-link.complete-rate", "value": "50%"}
  ]
}

【工作栏列移动详解】
简单形式: ["PHID-PCOL-1111"]
列表形式: ["PHID-PCOL-1111", "PHID-PCOL-2222"]
复杂形式: [{"columnPHID": "PHID-PCOL-1111", "beforePHID": "PHID-TASK-2222"}]
复杂形式: [{"columnPHID": "PHID-PCOL-1111", "afterPHID": "PHID-TASK-3333"}]

【自定义字段类型】
string: 字符串值
epoch: Unix时间戳
int: 整数值
list<string>: 字符串列表

【注意事项】
- objectIdentifier为空时创建新任务，有值时编辑现有任务
- 事务必须包含有效的type和value字段
- 某些事务类型有特定的值格式要求
- OAuth客户端无法调用此方法
- 返回包含操作结果的映射
- 支持批量事务操作
- 工作栏列移动支持多种格式
- 自定义字段根据系统配置可能有所不同`
      }
    },
  },
  'macro.query': {
    label: '宏查询',
    params: {
      authorPHIDs: { type: 'json', default: '[]', placeholder: '作者PHID列表（可选）' },
      phids: { type: 'json', default: '[]', placeholder: '宏PHID列表（可选）' },
      ids: { type: 'json', default: '[]', placeholder: '宏ID列表（可选）' },
      names: { type: 'json', default: '[]', placeholder: '宏名称列表（可选）' },
      nameLike: { type: 'string', default: '', placeholder: '宏名称模糊匹配（可选）' },
      _help: { 
        type: 'static',
        content: `宏查询使用指南:

【API功能】
检索图像宏信息。

【参数说明】
- authorPHIDs: 作者PHID列表，用于筛选特定作者创建的宏
- phids: 宏PHID列表，用于精确查询特定的宏
- ids: 宏ID列表，用于按ID查询宏
- names: 宏名称列表，用于按名称查询宏
- nameLike: 宏名称模糊匹配，支持部分匹配

【查询方式】
1. 按作者查询: 使用authorPHIDs参数
2. 按PHID查询: 使用phids参数
3. 按ID查询: 使用ids参数
4. 按名称查询: 使用names参数
5. 模糊名称查询: 使用nameLike参数
6. 组合查询: 可以同时使用多个参数

【参数格式】
authorPHIDs: ["PHID-USER-1111", "PHID-USER-2222"]
phids: ["PHID-MCR-1111", "PHID-MCR-2222"]
ids: [123, 456, 789]
names: ["macro1", "macro2", "macro3"]
nameLike: "test"

【返回信息】
返回宏信息列表，每个宏包含：
- id: 宏ID
- phid: 宏PHID
- name: 宏名称
- authorPHID: 作者PHID
- filePHID: 文件PHID
- dateCreated: 创建日期
- dateModified: 修改日期
- 其他宏相关属性

【使用场景】
- 查询特定作者创建的宏
- 按名称搜索宏
- 获取特定宏的详细信息
- 模糊匹配宏名称
- 批量查询多个宏

【查询示例】

按作者查询:
{
  "authorPHIDs": ["PHID-USER-1111"]
}

按PHID查询:
{
  "phids": ["PHID-MCR-1111", "PHID-MCR-2222"]
}

按ID查询:
{
  "ids": [123, 456]
}

按名称查询:
{
  "names": ["logo", "icon", "banner"]
}

模糊名称查询:
{
  "nameLike": "logo"
}

组合查询:
{
  "authorPHIDs": ["PHID-USER-1111"],
  "nameLike": "test"
}

【注意事项】
- 所有参数都是可选的
- 可以组合使用多个查询条件
- nameLike支持部分字符串匹配
- 返回结果是满足所有条件的宏列表
- OAuth客户端无法调用此方法
- 返回列表格式的数据
- 查询结果可能受权限限制影响`
      }
    },
  },
  'macro.edit': {
    label: '宏编辑',
    params: {
      transactions: { type: 'json', default: '[]', placeholder: '事务列表，见下方详细说明' },
      objectIdentifier: { type: 'string', default: '', placeholder: '宏ID或PHID，留空创建新宏' },
      _help: { 
        type: 'static',
        content: `宏编辑使用指南:

【API功能】
标准的ApplicationEditor方法，通过应用事务来创建和修改宏对象。

【参数说明】
- transactions: 事务列表，每个事务包含type和value字段
- objectIdentifier: 宏ID或PHID，留空时创建新宏

【事务类型】
comment: 添加评论
name: 设置宏名称
filePHID: 设置文件PHID
subscribers.add: 添加订阅者
subscribers.remove: 移除订阅者
subscribers.set: 设置订阅者

【事务格式】
每个事务对象包含:
{
  "type": "事务类型",
  "value": "事务值"
}

【事务类型详解】

1. comment - 添加评论
   - type: "comment"
   - value: 字符串，评论内容（支持remarkup格式）

2. name - 设置宏名称
   - type: "name"
   - value: 字符串，新的宏名称

3. filePHID - 设置文件PHID
   - type: "filePHID"
   - value: PHID，要导入的文件PHID

4. subscribers.add - 添加订阅者
   - type: "subscribers.add"
   - value: 数组，要添加的用户PHID列表

5. subscribers.remove - 移除订阅者
   - type: "subscribers.remove"
   - value: 数组，要移除的用户PHID列表

6. subscribers.set - 设置订阅者
   - type: "subscribers.set"
   - value: 数组，要设置的用户PHID列表（覆盖当前值）

【创建新宏示例】
{
  "objectIdentifier": "",
  "transactions": [
    {"type": "name", "value": "新宏名称"},
    {"type": "filePHID", "value": "PHID-FILE-1111"},
    {"type": "comment", "value": "创建了新宏"}
  ]
}

【编辑现有宏示例】
{
  "objectIdentifier": "123",
  "transactions": [
    {"type": "name", "value": "更新后的宏名称"},
    {"type": "filePHID", "value": "PHID-FILE-2222"},
    {"type": "comment", "value": "更新了宏信息"}
  ]
}

【订阅者管理示例】
添加订阅者:
{
  "objectIdentifier": "123",
  "transactions": [
    {"type": "subscribers.add", "value": ["PHID-USER-1111", "PHID-USER-2222"]}
  ]
}

移除订阅者:
{
  "objectIdentifier": "123",
  "transactions": [
    {"type": "subscribers.remove", "value": ["PHID-USER-3333"]}
  ]
}

设置订阅者:
{
  "objectIdentifier": "123",
  "transactions": [
    {"type": "subscribers.set", "value": ["PHID-USER-4444", "PHID-USER-5555"]}
  ]
}

【批量操作示例】
{
  "objectIdentifier": "123",
  "transactions": [
    {"type": "name", "value": "新宏名称"},
    {"type": "filePHID", "value": "PHID-FILE-1111"},
    {"type": "subscribers.add", "value": ["PHID-USER-1111"]},
    {"type": "comment", "value": "批量更新完成"}
  ]
}

【使用场景】
- 创建新的图像宏
- 更新现有宏的名称
- 更换宏的文件
- 管理宏的订阅者
- 添加评论和说明
- 批量修改宏属性

【注意事项】
- objectIdentifier为空时创建新宏，有值时编辑现有宏
- 事务必须包含有效的type和value字段
- filePHID必须是有效的文件PHID
- 订阅者操作支持批量处理
- subscribers.set会覆盖当前所有订阅者
- 评论内容支持remarkup格式
- OAuth客户端无法调用此方法
- 返回包含操作结果的映射
- 支持批量事务操作
- 宏名称不能为空
- 文件PHID必须指向有效的图像文件`
      }
    },
  },
  'harbormaster.build.search': {
    label: '构建搜索',
    params: {
      queryKey: { type: 'string', default: '', placeholder: '查询类型：initiated/all/waiting/active/completed' },
      constraints: { type: 'json', default: '{}', placeholder: '约束条件，见下方常用示例' },
      attachments: { type: 'json', default: '{}', placeholder: '附加信息，如：{"querybuilds":true}' },
      order: { type: 'string', default: 'newest', placeholder: '排序：newest/oldest' },
      before: { type: 'string', default: '', placeholder: '分页游标，获取前一页' },
      after: { type: 'string', default: '', placeholder: '分页游标，获取后一页' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制，默认100' },
      _help: { 
        type: 'static',
        content: `构建搜索使用指南:

【API功能】
标准的ApplicationSearch方法，用于列出、查询或搜索构建对象。

【参数说明】
- queryKey: 内置或保存的查询键
- constraints: 自定义约束条件
- attachments: 附加信息请求
- order: 结果排序方式
- before/after: 分页游标
- limit: 结果数量限制

【内置查询类型】
initiated: 我的构建
all: 所有构建
waiting: 等待中的构建
active: 已启用的构建
completed: 已完成的构建

【约束条件】
ids: 按ID列表搜索
phids: 按PHID列表搜索
plans: 按构建计划搜索
buildables: 按构建对象搜索
statuses: 按状态搜索
initiators: 按发起者搜索

【约束格式】
{
  "ids": [123, 456],
  "phids": ["PHID-HARB-1111", "PHID-HARB-2222"],
  "plans": ["plan1", "plan2"],
  "buildables": ["PHID-PROJ-1111"],
  "statuses": ["pending", "building", "passed", "failed"],
  "initiators": ["PHID-USER-1111"]
}

【排序选项】
newest: 创建日期（最新的优先）
oldest: 创建日期（最旧的优先）

【附加信息】
querybuilds: Harbormaster查询构建（兼容性字段）

【返回字段】
buildablePHID: 构建对象的PHID
buildPlanPHID: 构建计划的PHID
buildStatus: 构建当前状态
initiatorPHID: 发起者PHID
name: 构建名称
dateCreated: 创建时间戳
dateModified: 修改时间戳
policy: 权限策略映射

【使用场景】
- 查看我的构建任务
- 搜索特定状态的构建
- 按构建计划筛选
- 监控构建进度
- 分析构建历史

【查询示例】

基本查询（我的构建）:
{
  "queryKey": "initiated"
}

所有构建:
{
  "queryKey": "all"
}

等待中的构建:
{
  "queryKey": "waiting"
}

按状态约束:
{
  "constraints": {
    "statuses": ["building", "failed"]
  }
}

按构建计划约束:
{
  "constraints": {
    "plans": ["deploy", "test"]
  }
}

按发起者约束:
{
  "constraints": {
    "initiators": ["PHID-USER-1111"]
  }
}

组合约束:
{
  "constraints": {
    "statuses": ["passed"],
    "plans": ["deploy"],
    "initiators": ["PHID-USER-1111"]
  }
}

请求附加信息:
{
  "attachments": {
    "querybuilds": true
  }
}

排序和分页:
{
  "order": "newest",
  "limit": 50,
  "after": "1234"
}

【分页说明】
- 默认限制100个结果
- 使用before/after游标进行分页
- after为null表示没有下一页
- before为null表示没有上一页

【注意事项】
- queryKey和constraints可以组合使用
- constraints会覆盖queryKey的默认值
- 附加信息会增加查询时间和数据量
- 只请求需要的数据
- OAuth客户端无法调用此方法
- 返回标准化的搜索结果格式
- 支持自定义列排序（高级功能）
- 查询结果受权限限制影响`
      }
    },
  },
  'flag.query': {
    label: '标记查询',
    params: {
      ownerPHIDs: { type: 'json', default: '[]', placeholder: '所有者PHID列表（可选）' },
      types: { type: 'json', default: '[]', placeholder: '标记类型列表（可选）' },
      objectPHIDs: { type: 'json', default: '[]', placeholder: '对象PHID列表（可选）' },
      offset: { type: 'number', default: 0, placeholder: '偏移量，默认0' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制，默认100' },
      _help: { 
        type: 'static',
        content: `标记查询使用指南:

【API功能】
查询标记标记器。

【参数说明】
- ownerPHIDs: 所有者PHID列表，用于筛选特定用户创建的标记
- types: 标记类型列表，用于筛选特定类型的标记
- objectPHIDs: 对象PHID列表，用于筛选特定对象的标记
- offset: 偏移量，用于分页查询
- limit: 结果数量限制，默认100

【查询方式】
1. 按所有者查询: 使用ownerPHIDs参数
2. 按类型查询: 使用types参数
3. 按对象查询: 使用objectPHIDs参数
4. 组合查询: 可以同时使用多个参数
5. 分页查询: 使用offset和limit参数

【参数格式】
ownerPHIDs: ["PHID-USER-1111", "PHID-USER-2222"]
types: ["like", "dislike", "concern"]
objectPHIDs: ["PHID-TASK-1111", "PHID-PROJ-2222"]
offset: 0
limit: 100

【返回信息】
返回标记信息列表，每个标记包含：
- id: 标记ID
- phid: 标记PHID
- type: 标记类型
- ownerPHID: 所有者PHID
- objectPHID: 对象PHID
- dateCreated: 创建日期
- dateModified: 修改日期
- 其他标记相关属性

【使用场景】
- 查询特定用户创建的标记
- 按标记类型筛选
- 获取特定对象的标记
- 分页查询大量标记
- 统计标记数量
- 分析标记使用情况

【查询示例】

按所有者查询:
{
  "ownerPHIDs": ["PHID-USER-1111"]
}

按类型查询:
{
  "types": ["like", "dislike"]
}

按对象查询:
{
  "objectPHIDs": ["PHID-TASK-1111", "PHID-TASK-2222"]
}

组合查询:
{
  "ownerPHIDs": ["PHID-USER-1111"],
  "types": ["like"],
  "objectPHIDs": ["PHID-TASK-1111"]
}

分页查询:
{
  "offset": 0,
  "limit": 50
}

完整查询示例:
{
  "ownerPHIDs": ["PHID-USER-1111", "PHID-USER-2222"],
  "types": ["like", "dislike", "concern"],
  "objectPHIDs": ["PHID-TASK-1111"],
  "offset": 0,
  "limit": 100
}

【分页说明】
- offset指定从第几条结果开始
- limit指定返回多少条结果
- 默认offset为0，limit为100
- 可以通过调整offset实现分页

【常见标记类型】
like: 点赞
dislike: 点踩
concern: 关注
其他自定义标记类型

【注意事项】
- 所有参数都是可选的
- 可以组合使用多个查询条件
- 返回结果是满足所有条件的标记列表
- 支持分页查询，避免一次性返回过多数据
- OAuth客户端无法调用此方法
- 返回列表格式的数据
- 查询结果可能受权限限制影响
- 标记类型可能因系统配置而有所不同
- 对象PHID可以是任何支持标记的对象类型`
      }
    },
  },
  'flag.edit': {
    label: '标记编辑',
    params: {
      objectPHID: { type: 'string', default: '', placeholder: '对象PHID（必需）' },
      color: { type: 'number', default: 0, placeholder: '标记颜色（可选）' },
      note: { type: 'string', default: '', placeholder: '标记备注（可选）' },
      _help: { 
        type: 'static',
        content: `标记编辑使用指南:

【API功能】
创建或修改标记。

【参数说明】
- objectPHID: 要标记的对象PHID（必需参数）
- color: 标记颜色（可选参数）
- note: 标记备注（可选参数）

【参数详解】

1. objectPHID（必需）
   - 类型: PHID
   - 说明: 要标记的对象的PHID
   - 示例: "PHID-TASK-1111", "PHID-PROJ-2222"
   - 注意: 必须是有效的PHID格式

2. color（可选）
   - 类型: 整数
   - 说明: 标记的颜色代码
   - 示例: 0, 1, 2, 3...
   - 注意: 颜色代码可能因系统配置而不同

3. note（可选）
   - 类型: 字符串
   - 说明: 标记的备注或说明
   - 示例: "重要任务", "需要关注"
   - 注意: 可以包含任意文本内容

【使用场景】
- 为任务添加标记
- 为项目设置标记
- 标记重要内容
- 添加备注说明
- 分类管理对象

【操作类型】

创建新标记:
{
  "objectPHID": "PHID-TASK-1111",
  "color": 1,
  "note": "重要任务"
}

修改现有标记:
{
  "objectPHID": "PHID-TASK-1111",
  "color": 2,
  "note": "更新后的备注"
}

仅添加备注:
{
  "objectPHID": "PHID-TASK-1111",
  "note": "需要关注"
}

仅设置颜色:
{
  "objectPHID": "PHID-TASK-1111",
  "color": 3
}

【返回信息】
返回包含操作结果的字典，通常包含：
- success: 操作是否成功
- message: 操作结果消息
- flag: 标记的详细信息（如果成功）

【常见颜色代码】
0: 默认颜色
1: 红色
2: 橙色
3: 黄色
4: 绿色
5: 蓝色
6: 紫色
（具体颜色可能因系统而异）

【支持的对象类型】
- 任务 (PHID-TASK-*)
- 项目 (PHID-PROJ-*)
- 用户 (PHID-USER-*)
- 文件 (PHID-FILE-*)
- 其他支持标记的对象类型

【使用示例】

为任务添加红色标记:
{
  "objectPHID": "PHID-TASK-1234",
  "color": 1,
  "note": "紧急任务"
}

为项目添加绿色标记:
{
  "objectPHID": "PHID-PROJ-5678",
  "color": 4,
  "note": "进行中"
}

为文件添加备注:
{
  "objectPHID": "PHID-FILE-9012",
  "note": "重要文档"
}

批量操作（需要多次调用）:
第一次调用:
{
  "objectPHID": "PHID-TASK-1111",
  "color": 1,
  "note": "高优先级"
}

第二次调用:
{
  "objectPHID": "PHID-TASK-2222",
  "color": 1,
  "note": "高优先级"
}

【注意事项】
- objectPHID是必需参数，必须是有效的PHID
- color和note都是可选参数
- 如果标记已存在，会更新现有标记
- 如果标记不存在，会创建新标记
- 颜色代码可能因系统配置而有所不同
- 备注内容可以包含任意文本
- OAuth客户端无法调用此方法
- 返回字典格式的数据
- 操作结果受权限限制影响
- 每次调用只能操作一个对象
- 对象必须支持标记功能`
      }
    },
  },
  'flag.delete': {
    label: '标记删除',
    params: {
      id: { type: 'number', default: 0, placeholder: '标记ID（可选）' },
      objectPHID: { type: 'string', default: '', placeholder: '对象PHID（可选）' },
      _help: { 
        type: 'static',
        content: `标记删除使用指南:

【API功能】
清除标记。

【参数说明】
- id: 标记的ID（可选参数）
- objectPHID: 对象的PHID（可选参数）

【参数详解】

1. id（可选）
   - 类型: 整数
   - 说明: 要删除的标记的ID
   - 示例: 123, 456
   - 注意: 必须是有效的标记ID

2. objectPHID（可选）
   - 类型: PHID
   - 说明: 要清除标记的对象的PHID
   - 示例: "PHID-TASK-1111", "PHID-PROJ-2222"
   - 注意: 必须是有效的PHID格式

【参数使用规则】
- 必须提供id或objectPHID中的至少一个参数
- 如果同时提供两个参数，优先使用id
- id用于精确删除特定标记
- objectPHID用于清除对象上的所有标记

【使用场景】
- 删除特定标记
- 清除对象上的所有标记
- 清理不需要的标记
- 重置对象状态

【操作类型】

按ID删除标记:
{
  "id": 123
}

按对象PHID清除所有标记:
{
  "objectPHID": "PHID-TASK-1111"
}

【返回信息】
成功时返回包含操作结果的字典，失败时返回null：
- success: 操作是否成功
- message: 操作结果消息
- deleted: 删除的标记信息（如果成功）

【错误类型】
ERR_NOT_FOUND: 无效的标记ID
ERR_WRONG_USER: 您不是此标记的创建者
ERR_NEED_PARAM: 必须提供id或objectPHID参数
ERR-CONDUIT-CORE: 其他核心错误

【使用示例】

删除特定标记:
{
  "id": 123
}

清除任务的所有标记:
{
  "objectPHID": "PHID-TASK-4567"
}

清除项目的所有标记:
{
  "objectPHID": "PHID-PROJ-8901"
}

清除文件的所有标记:
{
  "objectPHID": "PHID-FILE-2345"
}

【权限说明】
- 只能删除自己创建的标记
- 管理员可以删除任何标记
- 对象PHID方式会清除该对象上的所有标记
- 删除操作不可逆，请谨慎使用

【支持的对象类型】
- 任务 (PHID-TASK-*)
- 项目 (PHID-PROJ-*)
- 用户 (PHID-USER-*)
- 文件 (PHID-FILE-*)
- 其他支持标记的对象类型

【批量删除】
如需批量删除多个标记，需要多次调用API：
第一次调用:
{
  "id": 111
}

第二次调用:
{
  "id": 222
}

第三次调用:
{
  "objectPHID": "PHID-TASK-3333"
}

【最佳实践】
1. 优先使用objectPHID清除对象的所有标记
2. 使用id进行精确的单个标记删除
3. 删除前确认标记的所有权
4. 谨慎使用批量删除操作
5. 记录删除操作以便审计

【注意事项】
- 必须提供id或objectPHID中的至少一个
- id和objectPHID都是可选参数，但不能同时为空
- 只能删除自己创建的标记（除非是管理员）
- 删除操作不可逆
- OAuth客户端无法调用此方法
- 返回字典格式或null的数据
- 操作结果受权限限制影响
- 清除操作会影响该对象上的所有标记
- 标记删除后无法恢复`
      }
    },
  },
  'file.uploadchunk': {
    label: '文件分块上传',
    params: {
      filePHID: { type: 'string', default: '', placeholder: '文件PHID（必需）' },
      byteStart: { type: 'number', default: 0, placeholder: '字节起始位置（必需）' },
      data: { type: 'string', default: '', placeholder: '数据内容（必需）' },
      dataEncoding: { type: 'string', default: 'base64', placeholder: '数据编码格式（可选）' },
      _help: { 
        type: 'static',
        content: `文件分块上传使用指南:

【API功能】
向服务器上传文件数据块。

【参数说明】
- filePHID: 文件的PHID（必需参数）
- byteStart: 字节起始位置（必需参数）
- data: 数据内容（必需参数）
- dataEncoding: 数据编码格式（可选参数）

【参数详解】

1. filePHID（必需）
   - 类型: PHID
   - 说明: 通过file.allocate获取的文件PHID
   - 示例: "PHID-FILE-1111"
   - 注意: 必须是有效的文件PHID

2. byteStart（必需）
   - 类型: 整数
   - 说明: 数据块在文件中的字节起始位置
   - 示例: 0, 1024, 2048
   - 注意: 必须与文件实际字节位置匹配

3. data（必需）
   - 类型: 字符串
   - 说明: 文件数据块的内容
   - 示例: "SGVsbG8gV29ybGQ=" (base64编码的"Hello World")
   - 注意: 通常使用base64编码

4. dataEncoding（可选）
   - 类型: 字符串
   - 说明: 数据编码格式
   - 示例: "base64", "utf8"
   - 默认值: "base64"

【使用流程】
1. 调用 file.allocate 预分配文件
2. 获取文件PHID
3. 将文件分割为数据块
4. 逐个调用 file.uploadchunk 上传数据块
5. 调用 file.complete 完成上传

【分块策略】
建议分块大小：
- 小文件: 64KB - 256KB
- 中等文件: 512KB - 1MB
- 大文件: 1MB - 4MB
- 超大文件: 4MB - 8MB

【使用场景】
- 大文件分块上传
- 断点续传
- 网络不稳定环境
- 并发上传
- 流式上传

【操作示例】

基本分块上传:
{
  "filePHID": "PHID-FILE-1234",
  "byteStart": 0,
  "data": "SGVsbG8gV29ybGQ=",
  "dataEncoding": "base64"
}

第二块上传:
{
  "filePHID": "PHID-FILE-1234",
  "byteStart": 11,
  "data": "VGhpcyBpcyBhIHRlc3Q=",
  "dataEncoding": "base64"
}

【完整上传流程示例】

第一步: 预分配文件
const allocation = await file.allocate({
  name: "test.txt",
  contentLength: 22,
  contentHash: "sha256:abc123"
});

第二步: 分块上传
await file.uploadchunk({
  filePHID: allocation.filePHID,
  byteStart: 0,
  data: "SGVsbG8gV29ybGQ="
});

await file.uploadchunk({
  filePHID: allocation.filePHID,
  byteStart: 11,
  data: "VGhpcyBpcyBhIHRlc3Q="
});

第三步: 完成上传
await file.complete({
  filePHID: allocation.filePHID
});

【分块计算】
分块数量计算：
chunkCount = Math.ceil(fileSize / chunkSize)

每个分块的起始位置：
chunkIndex 0: byteStart = 0
chunkIndex 1: byteStart = chunkSize
chunkIndex 2: byteStart = chunkSize * 2
...

最后一个分块的大小：
lastChunkSize = fileSize - (chunkCount - 1) * chunkSize

【错误处理】
常见错误：
- 无效的filePHID: 检查PHID是否正确
- 字节位置错误: 确认byteStart计算正确
- 数据编码错误: 使用正确的编码格式
- 文件未预分配: 先调用file.allocate
- 分块重叠: 确保分块不重叠
- 分块缺失: 确保所有分块都已上传

【最佳实践】
1. 合理设置分块大小
2. 按顺序上传分块
3. 记录上传进度
4. 实现断点续传
5. 处理网络错误重试
6. 验证数据完整性

【性能优化】
- 使用适当的分块大小
- 并发上传多个分块
- 压缩数据后再上传
- 使用更快的编码格式
- 实现智能重试机制

【安全考虑】
- 验证数据完整性
- 检查文件类型限制
- 监控上传速度
- 限制并发上传数量
- 记录上传日志

【注意事项】
- 必须先调用file.allocate预分配
- byteStart必须准确计算
- data通常使用base64编码
- 分块不能重叠或缺失
- 上传完成后调用file.complete
- OAuth客户端无法调用此方法
- 返回void类型，无具体返回值
- 操作受权限和存储限制影响
- 大文件上传建议使用分块方式`
      }
    },
  },
  'file.upload': {
    label: '文件上传',
    params: {
      data_base64: { type: 'string', default: '', placeholder: 'Base64编码的文件数据（必需）' },
      name: { type: 'string', default: '', placeholder: '文件名（可选）' },
      viewPolicy: { type: 'string', default: '', placeholder: '查看权限策略（可选）' },
      canCDN: { type: 'boolean', default: false, placeholder: '是否允许CDN分发（可选）' },
      _help: { 
        type: 'static',
        content: `文件上传使用指南:

【API功能】
向服务器上传文件。

【参数说明】
- data_base64: Base64编码的文件数据（必需参数）
- name: 文件名（可选参数）
- viewPolicy: 查看权限策略（可选参数）
- canCDN: 是否允许CDN分发（可选参数）

【参数详解】

1. data_base64（必需）
   - 类型: base64字节
   - 说明: 文件内容的Base64编码数据
   - 示例: "SGVsbG8gV29ybGQh" (base64编码的"Hello World!")
   - 注意: 必须是有效的Base64编码字符串

2. name（可选）
   - 类型: 字符串
   - 说明: 文件名称
   - 示例: "document.pdf", "image.png", "report.txt"
   - 注意: 如果不提供，系统可能生成默认名称

3. viewPolicy（可选）
   - 类型: 有效策略字符串或PHID
   - 说明: 文件的查看权限策略
   - 示例: "public", "admin", "PHID-PROJ-1111"
   - 注意: 必须符合系统的权限配置

4. canCDN（可选）
   - 类型: 布尔值
   - 说明: 是否允许通过CDN分发文件
   - 示例: true, false
   - 默认值: false

【使用场景】
- 直接上传小文件
- 快速文件分享
- 临时文件存储
- 图片上传
- 文档上传

【操作示例】

基本文件上传:
{
  "data_base64": "SGVsbG8gV29ybGQh",
  "name": "hello.txt"
}

带权限设置的上传:
{
  "data_base64 "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "name": "image.png",
  "viewPolicy": "public",
  "canCDN": true
}

仅上传数据:
{
  "data_base64": "SGVsbG8gV29ybGQh"
}

【Base64编码说明】
Base64是一种将二进制数据转换为ASCII字符串的编码方式：
- 原始数据: "Hello World!"
- Base64编码: "SGVsbG8gV29ybGQh"

常用编码方法：
JavaScript:
const fileData = "Hello World!";
const base64Data = btoa(fileData);

Python:
import base64
file_data = "Hello World!"
base64_data = base64.b64encode(file_data.encode()).decode()

【权限策略类型】
常见的viewPolicy选项：
- "public": 公开访问
- "admin": 仅管理员访问
- "users": 仅注册用户访问
- "PHID-PROJ-1111": 特定项目成员访问
- "PHID-USER-1111": 特定用户访问

【文件类型支持】
支持的文件类型：
- 文本文件: .txt, .md, .json, .xml
- 图片文件: .png, .jpg, .jpeg, .gif, .bmp
- 文档文件: .pdf, .doc, .docx, .xls, .xlsx
- 压缩文件: .zip, .rar, .7z, .tar.gz
- 其他二进制文件

【返回信息】
成功时返回非空的GUID（全局唯一标识符）：
- guid: 文件的唯一标识符
- 可用于后续的文件操作

【错误处理】
常见错误：
- 数据编码错误: 检查Base64编码是否正确
- 文件过大: 检查文件大小限制
- 权限不足: 确认有上传权限
- 存储空间不足: 联系管理员
- 文件类型限制: 检查允许的文件类型
- 权限策略无效: 使用有效的策略值

【最佳实践】
文件准备：
- 验证文件内容完整性
- 使用合适的文件名
- 设置适当的权限策略
- 考虑文件大小限制
- 检查文件类型限制

安全性考虑：
- 验证文件内容
- 设置适当的访问权限
- 避免上传敏感信息
- 使用HTTPS传输
- 定期清理临时文件

【性能优化】
- 压缩文件后再上传
- 使用适当的文件格式
- 批量上传小文件
- 避免重复上传相同文件
- 监控存储空间使用

【与分块上传的区别】
file.upload vs file.uploadchunk：

file.upload（直接上传）：
- 适用于小文件（通常<10MB）
- 一次性上传完整文件
- 简单快速
- 不需要预分配

file.uploadchunk（分块上传）：
- 适用于大文件
- 分块上传数据
- 支持断点续传
- 需要先调用file.allocate

【使用建议】
选择上传方式：
- 小文件（<10MB）: 使用file.upload
- 大文件（>10MB）: 使用file.uploadchunk
- 网络不稳定: 使用file.uploadchunk
- 需要断点续传: 使用file.uploadchunk
- 快速上传: 使用file.upload

【注意事项】
- data_base64必须是有效的Base64编码
- 文件大小受系统限制
- 权限策略必须有效
- OAuth客户端无法调用此方法
- 返回非空的GUID
- 操作受权限和存储限制影响
- 上传的文件会占用存储空间
- 考虑文件的生命周期管理`
      }
    },
  },
  'file.search': {
    label: '文件搜索',
    params: {
      queryKey: { type: 'string', default: '', placeholder: '查询类型：authored/all' },
      constraints: { type: 'json', default: '{}', placeholder: '约束条件，见下方常用示例' },
      attachments: { type: 'json', default: '{}', placeholder: '附加信息，如：{"subscribers":true}' },
      order: { type: 'string', default: 'newest', placeholder: '排序：newest/oldest' },
      before: { type: 'string', default: '', placeholder: '分页游标，获取前一页' },
      after: { type: 'string', default: '', placeholder: '分页游标，获取后一页' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制，默认100' },
      _help: { 
        type: 'static',
        content: `文件搜索使用指南:

【API功能】
标准的ApplicationSearch方法，用于列出、查询或搜索文件对象。

【参数说明】
- queryKey: 内置或保存的查询键
- constraints: 自定义约束条件
- attachments: 附加信息请求
- order: 结果排序方式
- before/after: 分页游标
- limit: 结果数量限制

【内置查询类型】
authored: 我创建的
all: 所有

【约束条件】
ids: 按ID列表搜索
phids: 按PHID列表搜索
authorPHIDs: 按作者PHID搜索
explicit: 上传来源
createdStart: 创建时间起始
createdEnd: 创建时间结束
name: 文件名包含
subscribers: 按订阅者搜索

【约束格式】
{
  "ids": [123, 456],
  "phids": ["PHID-FILE-1111", "PHID-FILE-2222"],
  "authorPHIDs": ["PHID-USER-1111"],
  "explicit": true,
  "createdStart": 1609459200,
  "createdEnd": 1609545600,
  "name": "document",
  "subscribers": ["PHID-USER-2222"]
}

【排序选项】
newest: 创建日期（最新的优先）
oldest: 创建日期（最旧的优先）

【附加信息】
subscribers: 获取订阅者信息

【返回字段】
name: 文件名称
dataURI: 文件下载URI
size: 文件大小（字节）
dateCreated: 创建时间戳
dateModified: 修改时间戳
policy: 权限策略映射

【使用场景】
- 查看我创建的文件
- 搜索特定名称的文件
- 按作者筛选文件
- 按创建时间范围搜索
- 获取文件订阅者信息
- 分页浏览文件列表

【查询示例】

基本查询（我创建的文件）:
{
  "queryKey": "authored"
}

所有文件:
{
  "queryKey": "all"
}

按文件名搜索:
{
  "constraints": {
    "name": "report"
  }
}

按作者搜索:
{
  "constraints": {
    "authorPHIDs": ["PHID-USER-1111"]
  }
}

按创建时间范围搜索:
{
  "constraints": {
    "createdStart": 1609459200,
    "createdEnd": 1609545600
  }
}

组合约束:
{
  "constraints": {
    "authorPHIDs": ["PHID-USER-1111"],
    "name": "document",
    "explicit": true
  }
}

请求附加信息:
{
  "attachments": {
    "subscribers": true
  }
}

排序和分页:
{
  "order": "newest",
  "limit": 50,
  "after": "1234"
}

【返回结果结构】
{
  "data": [
    {
      "id": 123,
      "phid": "PHID-FILE-1111",
      "fields": {
        "name": "document.pdf",
        "dataURI": "http://example.com/file/123",
        "size": 1024000,
        "dateCreated": 1609459200,
        "dateModified": 1609545600,
        "policy": {
          "view": "public",
          "edit": "admin"
        }
      },
      "attachments": {
        "subscribers": {
          "subscriberPHIDs": ["PHID-USER-2222"],
          "subscriberCount": 1,
          "viewerIsSubscribed": false
        }
      }
    }
  ],
  "cursor": {
    "limit": 100,
    "after": "1234",
    "before": null,
    "order": null
  }
}

【分页说明】
- 默认限制100个结果
- 使用before/after游标进行分页
- after为null表示没有下一页
- before为null表示没有上一页

【约束类型详解】

1. ids: 按文件ID搜索
   - 类型: list<int>
   - 示例: [123, 456, 789]

2. phids: 按文件PHID搜索
   - 类型: list<phid>
   - 示例: ["PHID-FILE-1111", "PHID-FILE-2222"]

3. authorPHIDs: 按作者搜索
   - 类型: list<user>
   - 示例: ["PHID-USER-1111", "PHID-USER-2222"]

4. explicit: 上传来源
   - 类型: bool
   - 说明: 是否为显式上传
   - 示例: true, false

5. createdStart/createdEnd: 创建时间范围
   - 类型: epoch
   - 说明: Unix时间戳
   - 示例: 1609459200, 1609545600

6. name: 文件名搜索
   - 类型: string
   - 说明: 文件名包含的字符串
   - 示例: "document", "report"

7. subscribers: 订阅者搜索
   - 类型: list<user>
   - 示例: ["PHID-USER-1111"]

【高级排序】
除了内置排序，还可以使用自定义列排序：
{
  "order": ["name", "-id"]
}

可用列：
- id: 文件ID（唯一）
- name: 文件名
- size: 文件大小
- dateCreated: 创建时间
- dateModified: 修改时间

【注意事项】
- queryKey和constraints可以组合使用
- constraints会覆盖queryKey的默认值
- 附加信息会增加查询时间和数据量
- 只请求需要的数据
- OAuth客户端无法调用此方法
- 返回标准化的搜索结果格式
- 查询结果受权限限制影响
- 文件名搜索支持部分匹配
- 时间戳使用Unix epoch格式`
      }
    },
  },
  'file.querychunks': {
    label: '文件分块查询',
    params: {
      filePHID: { type: 'string', default: '', placeholder: '文件PHID（必需）' },
      _help: { 
        type: 'static',
        content: `文件分块查询使用指南:

【API功能】
获取文件分块信息。

【参数说明】
- filePHID: 文件的PHID（必需参数）

【参数详解】

1. filePHID（必需）
   - 类型: PHID
   - 说明: 要查询分块信息的文件PHID
   - 示例: "PHID-FILE-1111"
   - 注意: 必须是有效的文件PHID

【使用场景】
- 检查文件分块状态
- 验证分块完整性
- 监控上传进度
- 调试分块上传问题
- 获取分块元数据

【操作示例】

基本查询:
{
  "filePHID": "PHID-FILE-1234"
}

【返回信息】
成功时返回包含分块信息的列表：
- 每个分块包含位置、大小、状态等信息
- 返回格式为list<wild>

【返回结果结构】
典型的返回结果可能包含：
[
  {
    "byteStart": 0,
    "byteEnd": 1024,
    "chunkSize": 1024,
    "status": "complete",
    "uploaded": true,
    "timestamp": 1609459200
  },
  {
    "byteStart": 1024,
    "byteEnd": 2048,
    "chunkSize": 1024,
    "status": "pending",
    "uploaded": false,
    "timestamp": null
  }
]

【返回字段说明】
- byteStart: 分块起始字节位置
- byteEnd: 分块结束字节位置
- chunkSize: 分块大小
- status: 分块状态（complete/pending/failed）
- uploaded: 是否已上传
- timestamp: 上传时间戳

【分块状态类型】
- complete: 已完成上传
- pending: 等待上传
- failed: 上传失败
- processing: 正在处理中

【使用流程】
1. 获取文件PHID（通过file.allocate或其他方式）
2. 调用file.querychunks查询分块状态
3. 分析返回的分块信息
4. 根据状态进行相应操作

【实际应用场景】

检查上传进度:
const chunks = await file.querychunks({
  filePHID: "PHID-FILE-1234"
});

const completedChunks = chunks.filter(c => c.uploaded);
const progress = (completedChunks.length / chunks.length) * 100;
console.log(\`上传进度: \${progress}%\`);

验证完整性:
const chunks = await file.querychunks({
  filePHID: "PHID-FILE-1234"
});

const allComplete = chunks.every(c => c.status === 'complete');
if (allComplete) {
  console.log('文件上传完整');
}

【错误处理】
常见错误：
- 无效的filePHID: 检查PHID是否正确
- 文件不存在: 确认文件已创建
- 权限不足: 确认有查看权限
- 分块信息不存在: 文件可能未使用分块上传

【与分块上传的关系】
file.querychunks与file.uploadchunk的关系：
- file.uploadchunk: 上传文件分块
- file.querychunks: 查询分块状态
- 两者配合使用实现分块上传管理

【最佳实践】
1. 在分块上传过程中定期查询状态
2. 使用返回信息计算上传进度
3. 检查分块完整性后再调用file.complete
4. 处理失败分块时重新上传
5. 缓存查询结果避免频繁调用

【性能考虑】
- 避免频繁查询分块状态
- 批量处理多个分块状态检查
- 使用适当的查询间隔
- 考虑缓存查询结果

【注意事项】
- filePHID必须是有效的文件PHID
- 只能查询已创建文件的分块信息
- 返回结果格式为列表
- OAuth客户端无法调用此方法
- 返回list<wild>类型的数据
- 查询结果受权限限制影响
- 仅适用于使用分块上传的文件
- 直接上传的文件可能没有分块信息
- 分块信息可能因系统状态而变化`
      }
    },
  },
  'file.download': {
    label: '文件下载',
    params: {
      phid: { type: 'string', default: '', placeholder: '文件PHID（必需）' },
      _help: { 
        type: 'static',
        content: `文件下载使用指南:

【API功能】
从服务器下载文件。

【参数说明】
- phid: 文件的PHID（必需参数）

【参数详解】

1. phid（必需）
   - 类型: PHID
   - 说明: 要下载的文件的PHID
   - 示例: "PHID-FILE-1111"
   - 注意: 必须是有效的文件PHID

【使用场景】
- 下载用户上传的文件
- 获取文件内容进行备份
- 文件内容分析和处理
- 集成外部系统
- 文件迁移和同步

【操作示例】

基本下载:
{
  "phid": "PHID-FILE-1234"
}

【返回信息】
成功时返回非空的Base64编码字节数据：
- 包含完整的文件内容
- 返回格式为base64-bytes
- 可直接解码为原始文件内容

【返回结果处理】
返回的数据是Base64编码的文件内容，需要解码：

JavaScript解码:
const base64Data = "SGVsbG8gV29ybGQh";
const binaryData = atob(base64Data);
const bytes = new Uint8Array(binaryData.length);
for (let i = 0; i < binaryData.length; i++) {
  bytes[i] = binaryData.charCodeAt(i);
}

Python解码:
import base64
base64_data = "SGVsbG8gV29ybGQh"
binary_data = base64.b64decode(base64_data)

【使用流程】
1. 获取文件PHID（通过file.search或其他方式）
2. 调用file.download下载文件内容
3. 解码Base64数据
4. 处理或保存文件内容

【实际应用场景】

下载并保存文件:
const fileData = await file.download({
  phid: "PHID-FILE-1234"
});

// 解码并保存
const binaryContent = atob(fileData);
const blob = new Blob([binaryContent]);
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'filename.ext';
a.click();

文件内容分析:
const fileData = await file.download({
  phid: "PHID-FILE-1234"
});

// 分析文本文件
const content = atob(fileData);
console.log('文件内容:', content);

// 分析JSON文件
try {
  const jsonData = JSON.parse(atob(fileData));
  console.log('JSON数据:', jsonData);
} catch (e) {
  console.log('非JSON文件');
}

【错误处理】
常见错误：
- ERR-BAD-PHID: 文件不存在
  - 检查PHID是否正确
  - 确认文件未被删除
- 权限不足: 确认有下载权限
- 文件过大: 考虑使用分块下载
- 网络错误: 重试下载操作

【文件类型处理】
不同文件类型的处理方式：

文本文件:
const content = atob(fileData);
console.log(content);

图片文件:
const binaryData = atob(fileData);
const blob = new Blob([binaryData], {type: 'image/png'});
const imageUrl = URL.createObjectURL(blob);

PDF文件:
const binaryData = atob(fileData);
const blob = new Blob([binaryData], {type: 'application/pdf'});
const pdfUrl = URL.createObjectURL(blob);

JSON文件:
try {
  const jsonData = JSON.parse(atob(fileData));
  console.log(jsonData);
} catch (e) {
  console.error('JSON解析失败:', e);
}

【性能考虑】
- 大文件下载可能占用较多内存
- 考虑使用流式处理大文件
- 下载完成后及时释放内存
- 避免重复下载相同文件
- 考虑缓存下载结果

【安全考虑】
- 验证文件类型和内容
- 检查文件大小限制
- 避免下载恶意文件
- 使用HTTPS传输
- 验证用户下载权限

【与其他文件API的关系】
file.download与其他文件API的配合：
- file.upload: 上传文件
- file.search: 查找文件PHID
- file.download: 下载文件内容
- file.info: 获取文件元信息

【最佳实践】
1. 先通过file.search获取文件信息
2. 检查文件大小和类型
3. 确认有下载权限
4. 下载后及时处理和释放内存
5. 处理各种可能的错误情况
6. 考虑文件大小对性能的影响

【注意事项】
- phid必须是有效的文件PHID
- 返回数据为Base64编码格式
- 需要解码才能获得原始文件内容
- 大文件下载可能影响性能
- OAuth客户端无法调用此方法
- 返回非空的base64-bytes数据
- 下载操作受权限限制影响
- 确保有足够的内存处理文件内容
- 下载敏感文件时注意安全性

【Base64编码说明】
Base64是一种将二进制数据转换为ASCII字符串的编码方式：
- 优点: 可以安全地在文本协议中传输二进制数据
- 缺点: 会增加约33%的数据量
- 用途: 在JSON等文本格式中传输文件内容

解码示例:
原始数据: "Hello World!"
Base64编码: "SGVsbG8gV29ybGQh"
解码后: "Hello World!"

【文件大小限制】
- 受系统配置的最大文件大小限制
- 受网络传输大小限制
- 受客户端内存限制
- 建议大文件使用分块下载方式

【批量下载】
如需下载多个文件：
const filePHIDs = ["PHID-FILE-1111", "PHID-FILE-2222"];
const downloads = filePHIDs.map(async (phid) => {
  try {
    const data = await file.download({phid});
    return {phid, data, success: true};
  } catch (error) {
    return {phid, error: error.message, success: false};
  }
});

const results = await Promise.all(downloads);
console.log('下载结果:', results);`
      }
    },
  },
  'drydock.blueprint.search': {
    label: 'Drydock蓝图搜索',
    params: {
      queryKey: { type: 'string', default: '', placeholder: '查询类型：active/all' },
      constraints: { type: 'json', default: '{}', placeholder: '约束条件，见下方常用示例' },
      attachments: { type: 'json', default: '{}', placeholder: '附加信息，如：{"projects":true}' },
      order: { type: 'string', default: 'newest', placeholder: '排序：newest/oldest' },
      before: { type: 'string', default: '', placeholder: '分页游标，获取前一页' },
      after: { type: 'string', default: '', placeholder: '分页游标，获取后一页' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制，默认100' },
      _help: { 
        type: 'static',
        content: `Drydock蓝图搜索使用指南:

【API功能】
标准的ApplicationSearch方法，用于列出、查询或搜索Drydock蓝图对象。

【参数说明】
- queryKey: 内置或保存的查询键
- constraints: 自定义约束条件
- attachments: 附加信息请求
- order: 结果排序方式
- before/after: 分页游标
- limit: 结果数量限制

【内置查询类型】
active: Active Blueprints（活跃蓝图）
all: All Blueprints（所有蓝图）

【约束条件】
ids: 按ID列表搜索
phids: 按PHID列表搜索
match: 按名称包含搜索
isDisabled: 按禁用状态搜索
projects: 按项目标签搜索

【约束格式】
{
  "ids": [123, 456],
  "phids": ["PHID-BLUE-1111", "PHID-BLUE-2222"],
  "match": "build",
  "isDisabled": false,
  "projects": ["PHID-PROJ-1111"]
}

【排序选项】
newest: 创建日期（最新的优先）
oldest: 创建日期（最旧的优先）

【附加信息】
projects: 获取项目信息

【返回字段】
name: 蓝图名称
type: 资源类型
dateCreated: 创建时间戳
dateModified: 修改时间戳
policy: 权限策略映射

【使用场景】
- 查看所有可用的蓝图
- 搜索特定类型的蓝图
- 按名称查找蓝图
- 按项目筛选蓝图
- 查找活跃或禁用的蓝图
- 分页浏览蓝图列表

【查询示例】

基本查询（活跃蓝图）:
{
  "queryKey": "active"
}

所有蓝图:
{
  "queryKey": "all"
}

按名称搜索:
{
  "constraints": {
    "match": "build"
  }
}

按ID搜索:
{
  "constraints": {
    "ids": [123, 456]
  }
}

按项目搜索:
{
  "constraints": {
    "projects": ["PHID-PROJ-1111"]
  }
}

查找未禁用的蓝图:
{
  "constraints": {
    "isDisabled": false
  }
}

组合约束:
{
  "constraints": {
    "match": "docker",
    "isDisabled": false,
    "projects": ["PHID-PROJ-1111"]
  }
}

请求附加信息:
{
  "attachments": {
    "projects": true
  }
}

排序和分页:
{
  "order": "newest",
  "limit": 50,
  "after": "1234"
}

【返回结果结构】
{
  "data": [
    {
      "id": 123,
      "phid": "PHID-BLUE-1111",
      "fields": {
        "name": "Docker Build Blueprint",
        "type": "docker.build",
        "dateCreated": 1609459200,
        "dateModified": 1609545600,
        "policy": {
          "view": "public",
          "edit": "admin"
        }
      },
      "attachments": {
        "projects": {
          "projectPHIDs": ["PHID-PROJ-2222"],
          "projectCount": 1,
          "viewerIsMember": false
        }
      }
    }
  ],
  "cursor": {
    "limit": 100,
    "after": "1234",
    "before": null,
    "order": null
  }
}

【分页说明】
- 默认限制100个结果
- 使用before/after游标进行分页
- after为null表示没有下一页
- before为null表示没有上一页

【约束类型详解】

1. ids: 按蓝图ID搜索
   - 类型: list<int>
   - 示例: [123, 456, 789]

2. phids: 按蓝图PHID搜索
   - 类型: list<phid>
   - 示例: ["PHID-BLUE-1111", "PHID-BLUE-2222"]

3. match: 按名称搜索
   - 类型: string
   - 说明: 蓝图名称包含的字符串
   - 示例: "build", "docker", "deploy"

4. isDisabled: 按禁用状态搜索
   - 类型: bool
   - 说明: 是否禁用蓝图
   - 示例: true, false

5. projects: 按项目标签搜索
   - 类型: list<project>
   - 说明: 搜索标记了特定项目的蓝图
   - 示例: ["PHID-PROJ-1111", "PHID-PROJ-2222"]

【高级排序】
除了内置排序，还可以使用自定义列排序：
{
  "order": ["name", "-id"]
}

可用列：
- id: 蓝图ID（唯一）
- name: 蓝图名称
- type: 资源类型
- dateCreated: 创建时间
- dateModified: 修改时间

【蓝图类型说明】
Drydock蓝图支持多种资源类型：
- docker.build: Docker构建
- docker.host: Docker主机
- repository: 代码仓库
- workspace: 工作空间
- resource: 通用资源

【使用流程】
1. 确定搜索目标（按类型、名称、项目等）
2. 选择合适的查询方式（queryKey或constraints）
3. 设置排序和分页参数
4. 执行搜索并处理结果
5. 根据需要获取附加信息

【实际应用场景】

查找所有Docker构建蓝图:
{
  "constraints": {
    "match": "docker"
  }
}

查找特定项目的蓝图:
{
  "constraints": {
    "projects": ["PHID-PROJ-1111"]
  }
}

查找活跃的构建蓝图:
{
  "queryKey": "active",
  "constraints": {
    "match": "build",
    "isDisabled": false
  }
}

【错误处理】
常见错误：
- 无效的queryKey: 使用有效的内置查询键
- 约束格式错误: 检查JSON格式
- 权限不足: 确认有查看权限
- 项目不存在: 使用有效的项目PHID
- 分页参数错误: 使用正确的游标值

【最佳实践】
1. 使用queryKey快速筛选
2. 结合constraints精确搜索
3. 只请求需要的附加信息
4. 合理设置分页大小
5. 缓存常用查询结果

【性能考虑】
- 附加信息会增加查询时间
- 复杂约束可能影响性能
- 大量结果需要分页处理
- 考虑缓存频繁查询的结果

【注意事项】
- queryKey和constraints可以组合使用
- constraints会覆盖queryKey的默认值
- 附加信息会增加查询时间和数据量
- 只请求需要的数据
- OAuth客户端无法调用此方法
- 返回标准化的搜索结果格式
- 查询结果受权限限制影响
- 蓝图名称搜索支持部分匹配
- 时间戳使用Unix epoch格式

【与Drydock系统的关系】
drydock.blueprint.search是Drydock资源管理系统的核心API：
- 用于查找可用的资源蓝图
- 支持资源编排和部署
- 与其他Drydock API配合使用
- 提供资源模板和配置管理

【相关API】
drydock.blueprint.create: 创建蓝图
drydock.blueprint.edit: 编辑蓝图
drydock.resource.search: 搜索资源实例
drydock.command.query: 查询命令状态`
      }
    },
  },
  'drydock.blueprint.edit': {
    label: 'Drydock蓝图编辑',
    params: {
      transactions: { type: 'json', default: '[]', placeholder: '事务列表，见下方详细说明' },
      objectIdentifier: { type: 'string', default: '', placeholder: '蓝图ID或PHID，留空创建新蓝图' },
      _help: { 
        type: 'static',
        content: `Drydock蓝图编辑使用指南:

【API功能】
标准的ApplicationEditor方法，用于通过应用事务来创建和修改Drydock蓝图对象。

【参数说明】
- transactions: 事务列表（必需参数）
- objectIdentifier: 蓝图ID或PHID（可选参数，留空创建新蓝图）

【参数详解】

1. transactions（必需）
   - 类型: list<map<string, wild>>
   - 说明: 要应用的事务列表
   - 示例: [{"type": "name", "value": "New Blueprint"}]
   - 注意: 必须是有效的事务数组

2. objectIdentifier（可选）
   - 类型: id|phid|string
   - 说明: 要编辑的蓝图ID或PHID，留空创建新蓝图
   - 示例: "123", "PHID-BLUE-1111", "blueprint-name"
   - 注意: 创建新蓝图时留空

【事务类型】
支持以下类型的事务：

1. type: 设置蓝图类型
   - 类型: const
   - 值: string
   - 说明: Blueprint type

2. name: 设置蓝图名称
   - 类型: const
   - 值: string
   - 说明: Name of the blueprint

3. view: 更改查看权限
   - 类型: const
   - 值: string
   - 说明: New policy PHID or constant

4. edit: 更改编辑权限
   - 类型: const
   - 值: string
   - 说明: New policy PHID or constant

5. projects.add: 添加项目标签
   - 类型: const
   - 值: list<project>
   - 说明: List of PHIDs to add

6. projects.remove: 移除项目标签
   - 类型: const
   - 值: list<project>
   - 说明: List of PHIDs to remove

7. projects.set: 设置项目标签，覆盖当前值
   - 类型: const
   - 值: list<project>
   - 说明: List of PHIDs to set

8. custom.blueprintPHIDs: 自定义蓝图PHID
   - 类型: const
   - 值: list<phid>
   - 说明: 自定义字段

9. custom.allocator.limit: 自定义分配器限制
   - 类型: const
   - 值: int
   - 说明: 自定义字段

【使用场景】
- 创建新的Drydock蓝图
- 修改现有蓝图的配置
- 更改蓝图名称和类型
- 管理蓝图的项目标签
- 设置权限策略
- 配置自定义字段

【操作示例】

创建新蓝图:
{
  "transactions": [
    {
      "type": "name",
      "value": "Docker Build Blueprint"
    },
    {
      "type": "type",
      "value": "docker.build"
    },
    {
      "type": "view",
      "value": "public"
    }
  ]
}

修改现有蓝图:
{
  "objectIdentifier": "PHID-BLUE-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Updated Blueprint Name"
    },
    {
      "type": "projects.add",
      "value": ["PHID-PROJ-1111"]
    }
  ]
}

设置项目标签:
{
  "objectIdentifier": "PHID-BLUE-1234",
  "transactions": [
    {
      "type": "projects.set",
      "value": ["PHID-PROJ-1111", "PHID-PROJ-2222"]
    }
  ]
}

更改权限:
{
  "objectIdentifier": "PHID-BLUE-1234",
  "transactions": [
    {
      "type": "view",
      "value": "admin"
    },
    {
      "type": "edit",
      "value": "admin"
    }
  ]
}

【事务格式详解】

每个事务对象包含以下字段：
- type: 事务类型（必需）
- value: 事务值（必需，类型根据事务类型而定）

事务类型详细说明：

1. type事务:
{
  "type": "type",
  "value": "docker.build"
}

支持的蓝图类型：
- docker.build: Docker构建
- docker.host: Docker主机
- repository: 代码仓库
- workspace: 工作空间
- resource: 通用资源

2. name事务:
{
  "type": "name",
  "value": "My Blueprint"
}

3. 权限事务:
{
  "type": "view",
  "value": "public"
}

权限值选项：
- public: 公开访问
- admin: 仅管理员
- 用户PHID: 特定用户
- 项目PHID: 特定项目成员

4. 项目标签事务:
添加项目:
{
  "type": "projects.add",
  "value": ["PHID-PROJ-1111", "PHID-PROJ-2222"]
}

移除项目:
{
  "type": "projects.remove",
  "value": ["PHID-PROJ-1111"]
}

设置项目（覆盖）:
{
  "type": "projects.set",
  "value": ["PHID-PROJ-1111"]
}

5. 自定义字段事务:
{
  "type": "custom.blueprintPHIDs",
  "value": ["PHID-BLUE-1111", "PHID-BLUE-2222"]
}

{
  "type": "custom.allocator.limit",
  "value": 10
}

【返回信息】
成功时返回包含以下信息的映射：
- id: 蓝图ID
- phid: 蓝图PHID
- name: 蓝图名称
- type: 蓝图类型
- 其他更新后的字段信息

【使用流程】
1. 确定操作类型（创建或编辑）
2. 准备事务列表
3. 设置objectIdentifier（编辑时）或留空（创建时）
4. 执行编辑操作
5. 处理返回结果

【实际应用场景】

创建Docker构建蓝图:
{
  "transactions": [
    {
      "type": "name",
      "value": "Docker Build Service"
    },
    {
      "type": "type", 
      "value": "docker.build"
    },
    {
      "type": "projects.add",
      "value": ["PHID-PROJ-BUILD"]
    },
    {
      "type": "view",
      "value": "public"
    },
    {
      "type": "custom.allocator.limit",
      "value": 5
    }
  ]
}

更新蓝图配置:
{
  "objectIdentifier": "PHID-BLUE-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Updated Docker Build Service"
    },
    {
      "type": "projects.set",
      "value": ["PHID-PROJ-BUILD", "PHID-PROJ-DEPLOY"]
    },
    {
      "type": "custom.allocator.limit",
      "value": 10
    }
  ]
}

批量操作示例:
const blueprints = [
  {
    objectIdentifier: "PHID-BLUE-1111",
    transactions: [{"type": "name", "value": "Blueprint 1"}]
  },
  {
    objectIdentifier: "PHID-BLUE-2222", 
    transactions: [{"type": "name", "value": "Blueprint 2"}]
  }
];

for (const blueprint of blueprints) {
  try {
    const result = await drydock.blueprint.edit(blueprint);
    console.log('更新成功:', result);
  } catch (error) {
    console.error('更新失败:', error);
  }
}

【错误处理】
常见错误：
- 无效的事务类型: 使用支持的事务类型
- 缺少必需字段: 确保每个事务都有type和value
- 权限不足: 确认有编辑权限
- 蓝图不存在: 使用有效的objectIdentifier
- 事务格式错误: 检查JSON格式
- 自定义字段错误: 使用有效的自定义字段

【最佳实践】
1. 使用有意义的事务顺序
2. 批量相关事务提高效率
3. 验证事务类型和值
4. 处理权限和验证错误
5. 记录重要的配置变更
6. 使用项目标签组织蓝图

【性能考虑】
- 批量事务比单个事务更高效
- 避免不必要的事务操作
- 合理设置自定义字段数量
- 考虑事务的原子性

【安全考虑】
- 验证用户权限
- 检查事务类型合法性
- 验证自定义字段值
- 记录重要操作日志
- 避免权限提升攻击

【与Drydock系统的关系】
drydock.blueprint.edit是Drydock资源管理系统的核心API：
- 用于创建和修改资源蓝图
- 支持资源模板管理
- 与其他Drydock API配合使用
- 提供资源编排配置

【相关API】
drydock.blueprint.search: 搜索蓝图
drydock.blueprint.create: 创建蓝图（等效于编辑时objectIdentifier为空）
drydock.resource.search: 搜索资源实例
drydock.command.query: 查询命令状态

【事务原子性】
- 同一调用中的所有事务原子执行
- 任一事务失败会导致整个操作回滚
- 建议将相关事务放在同一调用中

【版本控制】
- 蓝图变更会被记录
- 支持配置历史追踪
- 可以回滚到之前的版本
- 重要变更建议备份

【注意事项】
- transactions必须是有效的JSON数组
- objectIdentifier为空时创建新蓝图
- 事务类型必须受支持
- value类型必须匹配事务类型
- OAuth客户端无法调用此方法
- 返回map<string, wild>类型的数据
- 操作受权限和验证限制影响
- 自定义字段需要系统支持
- 事务执行是原子的，要么全部成功要么全部失败`
      }
    },
  },
  'drydock.authorization.search': {
    label: 'Drydock授权搜索',
    params: {
      queryKey: { type: 'string', default: '', placeholder: '查询类型：all' },
      constraints: { type: 'json', default: '{}', placeholder: '约束条件，见下方常用示例' },
      attachments: { type: 'json', default: '{}', placeholder: '附加信息，此API不支持附加信息' },
      order: { type: 'string', default: 'newest', placeholder: '排序：newest/oldest' },
      before: { type: 'string', default: '', placeholder: '分页游标，获取前一页' },
      after: { type: 'string', default: '', placeholder: '分页游标，获取后一页' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制，默认100' },
      _help: { 
        type: 'static',
        content: `Drydock授权搜索使用指南:

【API功能】
标准的ApplicationSearch方法，用于列出、查询或搜索Drydock授权对象。

【参数说明】
- queryKey: 内置或保存的查询键
- constraints: 自定义约束条件
- attachments: 附加信息请求（此API不支持）
- order: 结果排序方式
- before/after: 分页游标
- limit: 结果数量限制

【内置查询类型】
all: All Authorizations（所有授权）

【约束条件】
ids: 按ID列表搜索
phids: 按PHID列表搜索
blueprintPHIDs: 按蓝图PHID搜索
objectPHIDs: 按对象PHID搜索

【约束格式】
{
  "ids": [123, 456],
  "phids": ["PHID-AUTH-1111", "PHID-AUTH-2222"],
  "blueprintPHIDs": ["PHID-BLUE-1111"],
  "objectPHIDs": ["PHID-OBJ-1111"]
}

【排序选项】
newest: 创建日期（最新的优先）
oldest: 创建日期（最旧的优先）

【附加信息】
此API不支持任何附加信息。

【返回字段】
blueprintPHID: 蓝图PHID
blueprintAuthorizationState: 蓝图授权状态
objectPHID: 对象PHID
objectAuthorizationState: 对象授权状态
dateCreated: 创建时间戳
dateModified: 修改时间戳
policy: 权限策略映射

【使用场景】
- 查看所有Drydock授权请求
- 搜索特定蓝图的授权
- 查找特定对象的授权状态
- 监控授权请求状态
- 分析授权模式
- 分页浏览授权列表

【查询示例】

基本查询（所有授权）:
{
  "queryKey": "all"
}

按ID搜索:
{
  "constraints": {
    "ids": [123, 456]
  }
}

按PHID搜索:
{
  "constraints": {
    "phids": ["PHID-AUTH-1111", "PHID-AUTH-2222"]
  }
}

按蓝图搜索:
{
  "constraints": {
    "blueprintPHIDs": ["PHID-BLUE-1111"]
  }
}

按对象搜索:
{
  "constraints": {
    "objectPHIDs": ["PHID-OBJ-1111"]
  }
}

组合约束:
{
  "constraints": {
    "blueprintPHIDs": ["PHID-BLUE-1111"],
    "objectPHIDs": ["PHID-OBJ-1111"]
  }
}

排序和分页:
{
  "order": "newest",
  "limit": 50,
  "after": "1234"
}

【返回结果结构】
{
  "data": [
    {
      "id": 123,
      "phid": "PHID-AUTH-1111",
      "fields": {
        "blueprintPHID": "PHID-BLUE-2222",
        "blueprintAuthorizationState": {
          "state": "approved",
          "reason": null
        },
        "objectPHID": "PHID-OBJ-3333",
        "objectAuthorizationState": {
          "state": "pending",
          "reason": "Awaiting approval"
        },
        "dateCreated": 1609459200,
        "dateModified": 1609545600,
        "policy": {
          "view": "public",
          "edit": "admin"
        }
      }
    }
  ],
  "cursor": {
    "limit": 100,
    "after": "1234",
    "before": null,
    "order": null
  }
}

【分页说明】
- 默认限制100个结果
- 使用before/after游标进行分页
- after为null表示没有下一页
- before为null表示没有上一页

【约束类型详解】

1. ids: 按授权ID搜索
   - 类型: list<int>
   - 示例: [123, 456, 789]

2. phids: 按授权PHID搜索
   - 类型: list<phid>
   - 示例: ["PHID-AUTH-1111", "PHID-AUTH-2222"]

3. blueprintPHIDs: 按蓝图PHID搜索
   - 类型: list<phid>
   - 说明: 搜索特定蓝图的授权请求
   - 示例: ["PHID-BLUE-1111", "PHID-BLUE-2222"]

4. objectPHIDs: 按对象PHID搜索
   - 类型: list<phid>
   - 说明: 搜索特定对象的授权请求
   - 示例: ["PHID-OBJ-1111", "PHID-OBJ-2222"]

【高级排序】
除了内置排序，还可以使用自定义列排序：
{
  "order": ["blueprintPHID", "-id"]
}

可用列：
- id: 授权ID（唯一）
- blueprintPHID: 蓝图PHID
- objectPHID: 对象PHID
- dateCreated: 创建时间
- dateModified: 修改时间

【授权状态说明】
授权状态通常包含以下信息：
- state: 授权状态（approved/pending/rejected）
- reason: 状态原因或说明
- timestamp: 状态变更时间

【使用流程】
1. 确定搜索目标（按蓝图、对象、ID等）
2. 选择合适的查询方式（queryKey或constraints）
3. 设置排序和分页参数
4. 执行搜索并处理结果
5. 分析授权状态信息

【实际应用场景】

查找特定蓝图的所有授权:
{
  "constraints": {
    "blueprintPHIDs": ["PHID-BLUE-1111"]
  }
}

查找特定对象的所有授权:
{
  "constraints": {
    "objectPHIDs": ["PHID-OBJ-1111"]
  }
}

查找待处理的授权:
{
  "queryKey": "all",
  "order": "newest",
  "limit": 100
}

分析授权模式:
{
  "constraints": {
    "blueprintPHIDs": ["PHID-BLUE-1111", "PHID-BLUE-2222"]
  },
  "order": "oldest"
}

【错误处理】
常见错误：
- 无效的queryKey: 使用有效的内置查询键
- 约束格式错误: 检查JSON格式
- 权限不足: 确认有查看权限
- 蓝图不存在: 使用有效的蓝图PHID
- 对象不存在: 使用有效的对象PHID
- 分页参数错误: 使用正确的游标值

【最佳实践】
1. 使用queryKey快速筛选
2. 结合constraints精确搜索
3. 合理设置分页大小
4. 缓存频繁查询的结果
5. 监控授权状态变化

【性能考虑】
- 附加信息不支持，查询速度较快
- 复杂约束可能影响性能
- 大量结果需要分页处理
- 考虑缓存授权状态信息

【注意事项】
- queryKey和constraints可以组合使用
- constraints会覆盖queryKey的默认值
- 此API不支持任何附加信息
- 只请求需要的数据
- OAuth客户端无法调用此方法
- 返回标准化的搜索结果格式
- 查询结果受权限限制影响
- 时间戳使用Unix epoch格式

【与Drydock系统的关系】
drydock.authorization.search是Drydock资源管理系统的核心API：
- 用于查看资源授权状态
- 支持权限管理和审计
- 与其他Drydock API配合使用
- 提供授权历史追踪

【授权状态分析】
通过返回的授权状态信息可以：
- 监控授权请求进度
- 分析授权模式
- 识别权限问题
- 审计授权历史
- 优化授权流程

【相关API】
drydock.blueprint.search: 搜索蓝图
drydock.blueprint.edit: 编辑蓝图
drydock.resource.search: 搜索资源实例
drydock.command.query: 查询命令状态

【实际应用示例】

监控特定蓝图的授权状态:
const blueprintPHID = "PHID-BLUE-1111";
const authorizations = await drydock.authorization.search({
  constraints: {
    blueprintPHIDs: [blueprintPHID]
  },
  order: "newest"
});

// 分析授权状态
const pendingCount = authorizations.data.filter(auth => 
  auth.fields.blueprintAuthorizationState.state === 'pending'
).length;

console.log(\`待处理授权数量: \${pendingCount}\`);

查找对象的授权历史:
const objectPHID = "PHID-OBJ-1111";
const history = await drydock.authorization.search({
  constraints: {
    objectPHIDs: [objectPHID]
  },
  order: "oldest",
  limit: 50
});

// 按状态分组
const stateGroups = history.data.reduce((groups, auth) => {
  const state = auth.fields.objectAuthorizationState.state;
  groups[state] = (groups[state] || 0) + 1;
  return groups;
}, {});

console.log('授权状态分布:', stateGroups);`
      }
    },
  },
  'dashboard.panel.edit': {
    label: 'Dashboard面板编辑',
    params: {
      transactions: { type: 'json', default: '[]', placeholder: '事务列表，见下方详细说明' },
      objectIdentifier: { type: 'string', default: '', placeholder: '面板ID或PHID，留空创建新面板' },
      _help: { 
        type: 'static',
        content: `Dashboard面板编辑使用指南:

【API功能】
标准的ApplicationEditor方法，用于通过应用事务来创建和修改Dashboard面板对象。

【参数说明】
- transactions: 事务列表（必需参数）
- objectIdentifier: 面板ID或PHID（可选参数，留空创建新面板）

【参数详解】

1. transactions（必需）
   - 类型: list<map<string, wild>>
   - 说明: 要应用的事务列表
   - 示例: [{"type": "name", "value": "New Panel"}]
   - 注意: 必须是有效的事务数组

2. objectIdentifier（可选）
   - 类型: id|phid|string
   - 说明: 要编辑的面板ID或PHID，留空创建新面板
   - 示例: "123", "PHID-DASH-1111", "panel-name"
   - 注意: 创建新面板时留空

【事务类型】
支持以下类型的事务：

1. name: 重命名面板
   - 类型: const
   - 值: string
   - 说明: 新面板名称

2. view: 更改查看权限
   - 类型: const
   - 值: string
   - 说明: 新策略PHID或常量

3. edit: 更改编辑权限
   - 类型: const
   - 值: string
   - 说明: 新策略PHID或常量

【使用场景】
- 创建新的Dashboard面板
- 修改现有面板的名称
- 更改面板的权限设置
- 管理面板的访问控制
- 配置面板的编辑权限

【操作示例】

创建新面板:
{
  "transactions": [
    {
      "type": "name",
      "value": "My Dashboard Panel"
    }
  ]
}

修改面板名称:
{
  "objectIdentifier": "PHID-DASH-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Updated Panel Name"
    }
  ]
}

更改查看权限:
{
  "objectIdentifier": "PHID-DASH-1234",
  "transactions": [
    {
      "type": "view",
      "value": "public"
    }
  ]
}

更改编辑权限:
{
  "objectIdentifier": "PHID-DASH-1234",
  "transactions": [
    {
      "type": "edit",
      "value": "admin"
    }
  ]
}

批量修改面板:
{
  "objectIdentifier": "PHID-DASH-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Comprehensive Panel"
    },
    {
      "type": "view",
      "value": "public"
    },
    {
      "type": "edit",
      "value": "admin"
    }
  ]
}

【事务格式详解】

每个事务对象包含以下字段：
- type: 事务类型（必需）
- value: 事务值（必需，类型根据事务类型而定）

事务类型详细说明：

1. name事务:
{
  "type": "name",
  "value": "My Panel Name"
}

- 说明: 重命名面板
- 值类型: string
- 示例: "Development Dashboard", "Project Overview"

2. view事务:
{
  "type": "view",
  "value": "public"
}

- 说明: 更改查看权限
- 值类型: string
- 权限选项:
  - public: 公开访问
  - admin: 仅管理员
  - 用户PHID: 特定用户
  - 项目PHID: 特定项目成员

3. edit事务:
{
  "type": "edit",
  "value": "admin"
}

- 说明: 更改编辑权限
- 值类型: string
- 权限选项:
  - public: 公开编辑
  - admin: 仅管理员编辑
  - 用户PHID: 特定用户编辑
  - 项目PHID: 特定项目成员编辑

【返回信息】
成功时返回包含以下信息的映射：
- id: 面板ID
- phid: 面板PHID
- name: 面板名称
- 其他更新后的字段信息

【使用流程】
1. 确定操作类型（创建或编辑）
2. 准备事务列表
3. 设置objectIdentifier（编辑时）或留空（创建时）
4. 执行编辑操作
5. 处理返回结果

【实际应用场景】

创建个人Dashboard面板:
{
  "transactions": [
    {
      "type": "name",
      "value": "Personal Dashboard"
    },
    {
      "type": "view",
      "value": "PHID-USER-1111"
    },
    {
      "type": "edit",
      "value": "PHID-USER-1111"
    }
  ]
}

创建项目团队面板:
{
  "transactions": [
    {
      "type": "name",
      "value": "Team Project Dashboard"
    },
    {
      "type": "view",
      "value": "PHID-PROJ-1111"
    },
    {
      "type": "edit",
      "value": "PHID-PROJ-1111"
    }
  ]
}

更新现有面板配置:
{
  "objectIdentifier": "PHID-DASH-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Updated Team Dashboard"
    },
    {
      "type": "view",
      "value": "public"
    }
  ]
}

批量操作示例:
const panels = [
  {
    objectIdentifier: "PHID-DASH-1111",
    transactions: [{"type": "name", "value": "Panel 1"}]
  },
  {
    objectIdentifier: "PHID-DASH-2222", 
    transactions: [{"type": "name", "value": "Panel 2"}]
  }
];

for (const panel of panels) {
  try {
    const result = await dashboard.panel.edit(panel);
    console.log('面板更新成功:', result);
  } catch (error) {
    console.error('面板更新失败:', error);
  }
}

【错误处理】
常见错误：
- 无效的事务类型: 使用支持的事务类型
- 缺少必需字段: 确保每个事务都有type和value
- 权限不足: 确认有编辑权限
- 面板不存在: 使用有效的objectIdentifier
- 事务格式错误: 检查JSON格式
- 权限值无效: 使用有效的权限PHID或常量

【最佳实践】
1. 使用有意义的事务顺序
2. 批量相关事务提高效率
3. 验证事务类型和值
4. 处理权限和验证错误
5. 记录重要的配置变更
6. 合理设置面板权限

【性能考虑】
- 批量事务比单个事务更高效
- 避免不必要的事务操作
- 合理设置权限策略
- 考虑事务的原子性

【安全考虑】
- 验证用户权限
- 检查事务类型合法性
- 验证权限值有效性
- 记录重要操作日志
- 避免权限提升攻击

【与Dashboard系统的关系】
dashboard.panel.edit是Dashboard管理系统的核心API：
- 用于创建和修改Dashboard面板
- 支持面板权限管理
- 与其他Dashboard API配合使用
- 提供面板配置管理

【相关API】
dashboard.panel.search: 搜索面板
dashboard.query: 查询Dashboard
dashboard.install: 安装面板
其他Dashboard相关API

【事务原子性】
- 同一调用中的所有事务原子执行
- 任一事务失败会导致整个操作回滚
- 建议将相关事务放在同一调用中

【版本控制】
- 面板变更会被记录
- 支持配置历史追踪
- 可以回滚到之前的版本
- 重要变更建议备份

【权限管理最佳实践】
1. 个人面板: 设置为个人用户权限
2. 团队面板: 设置为项目权限
3. 公共面板: 谨慎设置公开权限
4. 管理面板: 限制为管理员权限
5. 定期审查权限设置

【面板命名规范】
1. 使用描述性名称
2. 避免特殊字符
3. 保持名称简洁明了
4. 考虑多语言支持
5. 避免名称冲突

【注意事项】
- transactions必须是有效的JSON数组
- objectIdentifier为空时创建新面板
- 事务类型必须受支持
- value类型必须匹配事务类型
- OAuth客户端无法调用此方法
- 返回map<string, wild>类型的数据
- 操作受权限和验证限制影响
- 事务执行是原子的，要么全部成功要么全部失败
- 权限值必须是有效的PHID或常量
- 面板名称不能为空

【实际应用示例】

创建开发团队Dashboard:
{
  "transactions": [
    {
      "type": "name",
      "value": "Development Team Dashboard"
    },
    {
      "type": "view",
      "value": "PHID-PROJ-DEV"
    },
    {
      "type": "edit",
      "value": "PHID-PROJ-DEV"
    }
  ]
}

创建管理面板:
{
  "transactions": [
    {
      "type": "name",
      "value": "System Administration Panel"
    },
    {
      "type": "view",
      "value": "admin"
    },
    {
      "type": "edit",
      "value": "admin"
    }
  ]
}

权限升级操作:
{
  "objectIdentifier": "PHID-DASH-1234",
  "transactions": [
    {
      "type": "view",
      "value": "public"
    },
    {
      "type": "edit",
      "value": "PHID-PROJ-1111"
    }
  ]
}

面板重命名和权限调整:
{
  "objectIdentifier": "PHID-DASH-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Updated Dashboard Panel"
    },
    {
      "type": "view",
      "value": "PHID-PROJ-2222"
    },
    {
      "type": "edit",
      "value": "PHID-PROJ-2222"
    }
  ]
}`
      }
    },
  },
  'countdown.search': {
    label: '倒计时搜索',
    params: {
      queryKey: { type: 'string', default: '', placeholder: '查询类型：upcoming/all/authored' },
      constraints: { type: 'json', default: '{}', placeholder: '约束条件，见下方常用示例' },
      attachments: { type: 'json', default: '{}', placeholder: '附加信息，如：{"subscribers":true,"projects":true}' },
      order: { type: 'string', default: 'newest', placeholder: '排序：ending/unending/newest/oldest' },
      before: { type: 'string', default: '', placeholder: '分页游标，获取前一页' },
      after: { type: 'string', default: '', placeholder: '分页游标，获取后一页' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制，默认100' },
      _help: { 
        type: 'static',
        content: `倒计时搜索使用指南:

【API功能】
标准的ApplicationSearch方法，用于列出、查询或搜索倒计时对象。

【参数说明】
- queryKey: 查询类型（可选参数）
- constraints: 约束条件（可选参数）
- attachments: 附加信息（可选参数）
- order: 排序方式（可选参数）
- before: 分页游标（可选参数）
- after: 分页游标（可选参数）
- limit: 结果数量限制（可选参数，默认100）

【参数详解】

1. queryKey（可选）
   - 类型: string
   - 说明: 选择内置查询或保存的查询作为过滤结果的起点
   - 默认值: 空（无约束）
   - 示例: "upcoming", "all", "authored"

2. constraints（可选）
   - 类型: map<string, wild>
   - 说明: 应用自定义约束来搜索特定的结果集
   - 默认值: {}
   - 示例: {"authorPHIDs": ["PHID-USER-1111"], "upcoming": ["true"]}

3. attachments（可选）
   - 类型: map<string, bool>
   - 说明: 请求额外的附加信息
   - 默认值: {}
   - 示例: {"subscribers": true, "projects": true}

4. order（可选）
   - 类型: order
   - 说明: 选择结果的排序方式
   - 默认值: newest
   - 示例: "ending", "unending", "newest", "oldest"

5. before（可选）
   - 类型: string
   - 说明: 获取前一页的分页游标
   - 默认值: ""
   - 示例: "1234"

6. after（可选）
   - 类型: string
   - 说明: 获取后一页的分页游标
   - 默认值: ""
   - 示例: "5678"

7. limit（可选）
   - 类型: int
   - 说明: 结果数量限制
   - 默认值: 100
   - 示例: 50

【内置查询类型】
支持以下内置查询：

1. upcoming: 即将来临
   - 说明: 获取即将到来的倒计时
   - 类型: 内置查询

2. all: 所有
   - 说明: 获取所有倒计时
   - 类型: 内置查询

3. authored: 我创建的
   - 说明: 获取当前用户创建的倒计时
   - 类型: 内置查询

【约束条件】
支持以下约束键：

1. ids: IDs
   - 类型: list<int>
   - 说明: 搜索具有特定ID的对象
   - 示例: [1, 2, 3]

2. phids: PHIDs
   - 类型: list<phid>
   - 说明: 搜索具有特定PHIDs的对象
   - 示例: ["PHID-COUNT-1111", "PHID-COUNT-2222"]

3. authorPHIDs: 作者
   - 类型: list<user>
   - 说明: 按作者筛选
   - 示例: ["PHID-USER-1111", "PHID-USER-2222"]

4. upcoming: 即将到来
   - 类型: list<string>
   - 说明: 按即将到来状态筛选
   - 示例: ["true", "false"]

5. subscribers: 订阅者
   - 类型: list<user>
   - 说明: 搜索具有特定订阅者的对象
   - 示例: ["PHID-USER-1111"]

6. projects: 标签
   - 类型: list<project>
   - 说明: 搜索标记为给定项目的对象
   - 示例: ["PHID-PROJ-1111"]

7. spaces: 空间
   - 类型: list<phid>
   - 说明: 搜索特定空间中的对象
   - 示例: ["PHID-SPCE-1111"]

【排序选项】
支持以下内置排序：

1. ending: 结束日期（从过去到未来）
   - 说明: 按结束日期从早到晚排序
   - 列: -epoch, -id

2. unending: 结束日期（从未来到过去）
   - 说明: 按结束日期从晚到早排序
   - 列: epoch, id

3. newest: 创建日期（最新的优先）
   - 说明: 按创建日期从新到旧排序
   - 列: id

4. oldest: 创建日期（最旧的优先）
   - 说明: 按创建日期从旧到新排序
   - 列: -id

【自定义列排序】
支持以下低级列：
- epoch: 时间戳（非唯一）
- id: ID（唯一）

自定义排序示例：
["epoch", "id"] - 按时间戳和ID排序
["-epoch", "-id"] - 按时间戳和ID降序排序

【对象字段】
返回的对象包含以下字段：

1. title: 标题
   - 类型: string
   - 说明: 倒计时的标题

2. description: 描述
   - 类型: remarkup
   - 说明: 倒计时的描述

3. epoch: 结束时间
   - 类型: epoch
   - 说明: 倒计时的结束日期

4. spacePHID: 空间PHID
   - 类型: phid?
   - 说明: 此对象所属的策略空间的PHID

5. dateCreated: 创建日期
   - 类型: int
   - 说明: 对象创建时的Unix时间戳

6. dateModified: 修改日期
   - 类型: int
   - 说明: 对象最后更新时的Unix时间戳

7. policy: 策略
   - 类型: map<string, wild>
   - 说明: 功能到当前策略的映射

【附加信息】
支持以下附加信息：

1. subscribers: 订阅者
   - 说明: 获取订阅者信息
   - 返回: subscriberPHIDs, subscriberCount, viewerIsSubscribed

2. projects: 项目
   - 说明: 获取项目信息
   - 返回: projectPHIDs, projectCount

【使用场景】
- 搜索即将到来的倒计时
- 查找特定用户创建的倒计时
- 按项目筛选倒计时
- 按结束日期排序倒计时
- 获取倒计时的订阅者信息
- 分页浏览大量倒计时数据

【操作示例】

基本搜索:
{
  "queryKey": "upcoming"
}

按作者搜索:
{
  "constraints": {
    "authorPHIDs": ["PHID-USER-1111"]
  }
}

按项目搜索:
{
  "constraints": {
    "projects": ["PHID-PROJ-1111"]
  }
}

按结束日期排序:
{
  "order": "ending"
}

包含附加信息:
{
  "attachments": {
    "subscribers": true,
    "projects": true
  }
}

复合查询:
{
  "queryKey": "upcoming",
  "constraints": {
    "authorPHIDs": ["PHID-USER-1111"],
    "projects": ["PHID-PROJ-1111"]
  },
  "attachments": {
    "subscribers": true
  },
  "order": "ending",
  "limit": 50
}

【分页处理】
查询限制为每次返回100个结果。如果需要更多结果，需要进行额外的查询。

分页示例：
// 第一次查询
{
  "limit": 100
}

// 获取下一页
{
  "after": "1234",
  "limit": 100
}

// 获取上一页
{
  "before": "5678",
  "limit": 100
}

【返回信息】
成功时返回包含以下信息的映射：
- data: 对象列表
- cursor: 分页游标信息
- maps: 相关映射数据

结果结构示例：
{
  "data": [
    {
      "id": 123,
      "phid": "PHID-COUNT-1111",
      "fields": {
        "title": "项目截止日期",
        "description": "项目第一阶段完成时间",
        "epoch": 1640995200,
        "spacePHID": "PHID-SPCE-1111",
        "dateCreated": 1640908800,
        "dateModified": 1640908800,
        "policy": {
          "view": "public",
          "edit": "admin"
        }
      },
      "attachments": {
        "subscribers": {
          "subscriberPHIDs": ["PHID-USER-1111"],
          "subscriberCount": 1,
          "viewerIsSubscribed": false
        }
      }
    }
  ],
  "cursor": {
    "limit": 100,
    "after": "1234",
    "before": null,
    "order": null
  }
}

【实际应用场景】

搜索即将到来的项目倒计时:
{
  "queryKey": "upcoming",
  "constraints": {
    "projects": ["PHID-PROJ-DEV"]
  },
  "order": "ending",
  "limit": 20
}

获取我创建的所有倒计时:
{
  "queryKey": "authored",
  "attachments": {
    "subscribers": true,
    "projects": true
  }
}

按特定条件搜索:
{
  "constraints": {
    "authorPHIDs": ["PHID-USER-1111"],
    "upcoming": ["true"],
    "projects": ["PHID-PROJ-1111"]
  },
  "order": "ending",
  "limit": 50
}

【错误处理】
常见错误：
- 无效的queryKey: 使用支持的查询类型
- 约束格式错误: 检查JSON格式
- 权限不足: 确认有查看权限
- 分页游标无效: 使用正确的游标值
- 附加信息不支持: 使用支持的附加信息类型

【最佳实践】
1. 使用合适的queryKey提高查询效率
2. 合理设置limit避免过多数据
3. 使用attachments获取必要信息
4. 正确处理分页游标
5. 组合约束条件精确搜索
6. 选择合适的排序方式

【性能考虑】
- 请求更多附加信息会降低查询速度
- 复杂约束条件可能影响性能
- 合理设置limit减少数据传输
- 使用分页处理大量数据

【安全考虑】
- OAuth客户端无法调用此方法
- 受权限和验证限制影响
- 敏感信息受策略保护
- 记录重要查询操作

【相关API】
countdown.edit: 编辑倒计时
其他倒计时相关API

【注意事项】
- 返回map<string, wild>类型的数据
- OAuth客户端无法调用此方法
- 查询限制为100个结果
- 分页游标用于获取更多结果
- 附加信息会增加查询时间
- 约束条件会覆盖queryKey的默认值
- 自定义排序是高级功能
- 必须指定唯一的最后一列

【实际应用示例】

项目管理倒计时:
{
  "queryKey": "upcoming",
  "constraints": {
    "projects": ["PHID-PROJ-PROJECT1", "PHID-PROJ-PROJECT2"]
  },
  "order": "ending",
  "attachments": {
    "subscribers": true,
    "projects": true
  }
}

个人倒计时管理:
{
  "queryKey": "authored",
  "constraints": {
    "upcoming": ["true"]
  },
  "order": "ending",
  "limit": 20
}

团队倒计时监控:
{
  "constraints": {
    "authorPHIDs": ["PHID-USER-1111", "PHID-USER-2222"],
    "projects": ["PHID-PROJ-TEAM"]
  },
  "attachments": {
    "subscribers": true
  },
  "order": "ending"
}`
      }
    },
  },
  'countdown.edit': {
    label: '倒计时编辑',
    params: {
      transactions: { type: 'json', default: '[]', placeholder: '事务列表，见下方详细说明' },
      objectIdentifier: { type: 'string', default: '', placeholder: '倒计时ID或PHID，留空创建新倒计时' },
      _help: { 
        type: 'static',
        content: `倒计时编辑使用指南:

【API功能】
标准的ApplicationEditor方法，用于通过应用事务来创建和修改倒计时对象。

【参数说明】
- transactions: 事务列表（必需参数）
- objectIdentifier: 倒计时ID或PHID（可选参数，留空创建新倒计时）

【参数详解】

1. transactions（必需）
   - 类型: list<map<string, wild>>
   - 说明: 要应用的事务列表
   - 示例: [{"type": "name", "value": "New Countdown"}]
   - 注意: 必须是有效的事务数组

2. objectIdentifier（可选）
   - 类型: id|phid|string
   - 说明: 要编辑的倒计时ID或PHID，留空创建新倒计时
   - 示例: "123", "PHID-COUNT-1111", "countdown-name"
   - 注意: 创建新倒计时时留空

【事务类型】
支持以下类型的事务：

1. space: 在空间之间移动对象
   - 类型: const
   - 值: phid
   - 说明: 新空间PHID

2. comment: 添加评论
   - 类型: const
   - 值: string
   - 说明: 要添加的评论，格式化为remarkup

3. name: 重命名倒计时
   - 类型: const
   - 值: string
   - 说明: 新倒计时名称

4. epoch: 更改倒计时结束日期
   - 类型: const
   - 值: epoch
   - 说明: 新倒计时结束日期

5. description: 更改倒计时描述
   - 类型: const
   - 值: string
   - 说明: 新描述

6. view: 更改对象的查看策略
   - 类型: const
   - 值: string
   - 说明: 新策略PHID或常量

7. edit: 更改对象的编辑策略
   - 类型: const
   - 值: string
   - 说明: 新策略PHID或常量

8. projects.add: 添加项目标签
   - 类型: const
   - 值: list<project>
   - 说明: 要添加的PHID列表

9. projects.remove: 移除项目标签
   - 类型: const
   - 值: list<project>
   - 说明: 要移除的PHID列表

10. projects.set: 设置项目标签，覆盖当前值
    - 类型: const
    - 值: list<project>
    - 说明: 要设置的PHID列表

11. subscribers.add: 添加订阅者
    - 类型: const
    - 值: list<user>
    - 说明: 要添加的PHID列表

12. subscribers.remove: 移除订阅者
    - 类型: const
    - 值: list<user>
    - 说明: 要移除的PHID列表

13. subscribers.set: 设置订阅者，覆盖当前值
    - 类型: const
    - 值: list<user>
    - 说明: 要设置的PHID列表

【使用场景】
- 创建新的倒计时
- 修改现有倒计时的名称
- 更改倒计时的结束日期
- 更新倒计时描述
- 管理倒计时的权限设置
- 添加或移除项目标签
- 管理订阅者
- 添加评论

【操作示例】

创建新倒计时:
{
  "transactions": [
    {
      "type": "name",
      "value": "My Countdown"
    },
    {
      "type": "epoch",
      "value": 1640995200
    },
    {
      "type": "description",
      "value": "Project deadline countdown"
    }
  ]
}

修改倒计时名称:
{
  "objectIdentifier": "PHID-COUNT-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Updated Countdown Name"
    }
  ]
}

更改结束日期:
{
  "objectIdentifier": "PHID-COUNT-1234",
  "transactions": [
    {
      "type": "epoch",
      "value": 1641081600
    }
  ]
}

更新描述:
{
  "objectIdentifier": "PHID-COUNT-1234",
  "transactions": [
    {
      "type": "description",
      "value": "Updated project description with more details"
    }
  ]
}

更改查看权限:
{
  "objectIdentifier": "PHID-COUNT-1234",
  "transactions": [
    {
      "type": "view",
      "value": "public"
    }
  ]
}

更改编辑权限:
{
  "objectIdentifier": "PHID-COUNT-1234",
  "transactions": [
    {
      "type": "edit",
      "value": "admin"
    }
  ]
}

添加项目标签:
{
  "objectIdentifier": "PHID-COUNT-1234",
  "transactions": [
    {
      "type": "projects.add",
      "value": ["PHID-PROJ-1111", "PHID-PROJ-2222"]
    }
  ]
}

移除项目标签:
{
  "objectIdentifier": "PHID-COUNT-1234",
  "transactions": [
    {
      "type": "projects.remove",
      "value": ["PHID-PROJ-1111"]
    }
  ]
}

设置项目标签:
{
  "objectIdentifier": "PHID-COUNT-1234",
  "transactions": [
    {
      "type": "projects.set",
      "value": ["PHID-PROJ-3333"]
    }
  ]
}

添加订阅者:
{
  "objectIdentifier": "PHID-COUNT-1234",
  "transactions": [
    {
      "type": "subscribers.add",
      "value": ["PHID-USER-1111", "PHID-USER-2222"]
    }
  ]
}

移除订阅者:
{
  "objectIdentifier": "PHID-COUNT-1234",
  "transactions": [
    {
      "type": "subscribers.remove",
      "value": ["PHID-USER-1111"]
    }
  ]
}

设置订阅者:
{
  "objectIdentifier": "PHID-COUNT-1234",
  "transactions": [
    {
      "type": "subscribers.set",
      "value": ["PHID-USER-3333"]
    }
  ]
}

添加评论:
{
  "objectIdentifier": "PHID-COUNT-1234",
  "transactions": [
    {
      "type": "comment",
      "value": "This countdown has been updated with new deadline."
    }
  ]
}

更改空间:
{
  "objectIdentifier": "PHID-COUNT-1234",
  "transactions": [
    {
      "type": "space",
      "value": "PHID-SPCE-1111"
    }
  ]
}

批量修改倒计时:
{
  "objectIdentifier": "PHID-COUNT-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Comprehensive Countdown"
    },
    {
      "type": "epoch",
      "value": 1640995200
    },
    {
      "type": "description",
      "value": "Complete project countdown with all details"
    },
    {
      "type": "view",
      "value": "public"
    },
    {
      "type": "edit",
      "value": "admin"
    },
    {
      "type": "projects.add",
      "value": ["PHID-PROJ-1111"]
    },
    {
      "type": "subscribers.add",
      "value": ["PHID-USER-1111"]
    }
  ]
}

【事务格式详解】

每个事务对象包含以下字段：
- type: 事务类型（必需）
- value: 事务值（必需，类型根据事务类型而定）

事务类型详细说明：

1. space事务:
{
  "type": "space",
  "value": "PHID-SPCE-1111"
}

- 说明: 在空间之间移动对象
- 值类型: phid
- 示例: "PHID-SPCE-1111"

2. comment事务:
{
  "type": "comment",
  "value": "This is a remarkup formatted comment."
}

- 说明: 添加评论
- 值类型: string
- 格式: remarkup格式

3. name事务:
{
  "type": "name",
  "value": "My Countdown Name"
}

- 说明: 重命名倒计时
- 值类型: string
- 示例: "Project Deadline", "Release Date"

4. epoch事务:
{
  "type": "epoch",
  "value": 1640995200
}

- 说明: 更改倒计时结束日期
- 值类型: epoch
- 示例: Unix时间戳

5. description事务:
{
  "type": "description",
  "value": "Detailed description of the countdown purpose."
}

- 说明: 更改倒计时描述
- 值类型: string
- 格式: remarkup格式

6. view事务:
{
  "type": "view",
  "value": "public"
}

- 说明: 更改查看权限
- 值类型: string
- 权限选项:
  - public: 公开访问
  - admin: 仅管理员
  - 用户PHID: 特定用户
  - 项目PHID: 特定项目成员

7. edit事务:
{
  "type": "edit",
  "value": "admin"
}

- 说明: 更改编辑权限
- 值类型: string
- 权限选项:
  - public: 公开编辑
  - admin: 仅管理员编辑
  - 用户PHID: 特定用户编辑
  - 项目PHID: 特定项目成员编辑

8. projects.add事务:
{
  "type": "projects.add",
  "value": ["PHID-PROJ-1111", "PHID-PROJ-2222"]
}

- 说明: 添加项目标签
- 值类型: list<project>
- 示例: 项目PHID列表

9. projects.remove事务:
{
  "type": "projects.remove",
  "value": ["PHID-PROJ-1111"]
}

- 说明: 移除项目标签
- 值类型: list<project>
- 示例: 要移除的项目PHID列表

10. projects.set事务:
{
  "type": "projects.set",
  "value": ["PHID-PROJ-3333"]
}

- 说明: 设置项目标签，覆盖当前值
- 值类型: list<project>
- 示例: 要设置的项目PHID列表

11. subscribers.add事务:
{
  "type": "subscribers.add",
  "value": ["PHID-USER-1111", "PHID-USER-2222"]
}

- 说明: 添加订阅者
- 值类型: list<user>
- 示例: 用户PHID列表

12. subscribers.remove事务:
{
  "type": "subscribers.remove",
  "value": ["PHID-USER-1111"]
}

- 说明: 移除订阅者
- 值类型: list<user>
- 示例: 要移除的用户PHID列表

13. subscribers.set事务:
{
  "type": "subscribers.set",
  "value": ["PHID-USER-3333"]
}

- 说明: 设置订阅者，覆盖当前值
- 值类型: list<user>
- 示例: 要设置的用户PHID列表

【返回信息】
成功时返回包含以下信息的映射：
- id: 倒计时ID
- phid: 倒计时PHID
- name: 倒计时名称
- epoch: 结束时间
- description: 描述
- 其他更新后的字段信息

【使用流程】
1. 确定操作类型（创建或编辑）
2. 准备事务列表
3. 设置objectIdentifier（编辑时）或留空（创建时）
4. 执行编辑操作
5. 处理返回结果

【实际应用场景】

创建项目倒计时:
{
  "transactions": [
    {
      "type": "name",
      "value": "Project Release Countdown"
    },
    {
      "type": "epoch",
      "value": 1640995200
    },
    {
      "type": "description",
      "value": "Countdown for the next major project release"
    },
    {
      "type": "projects.add",
      "value": ["PHID-PROJ-PROJECT1"]
    },
    {
      "type": "subscribers.add",
      "value": ["PHID-USER-TEAM1"]
    }
  ]
}

更新倒计时截止日期:
{
  "objectIdentifier": "PHID-COUNT-1234",
  "transactions": [
    {
      "type": "epoch",
      "value": 1641081600
    },
    {
      "type": "comment",
      "value": "Deadline extended by one week due to scope changes."
    }
  ]
}

权限升级操作:
{
  "objectIdentifier": "PHID-COUNT-1234",
  "transactions": [
    {
      "type": "view",
      "value": "public"
    },
    {
      "type": "edit",
      "value": "PHID-PROJ-1111"
    }
  ]
}

批量操作示例:
const countdowns = [
  {
    objectIdentifier: "PHID-COUNT-1111",
    transactions: [{"type": "epoch", "value": 1640995200}]
  },
  {
    objectIdentifier: "PHID-COUNT-2222", 
    transactions: [{"type": "epoch", "value": 1641081600}]
  }
];

for (const countdown of countdowns) {
  try {
    const result = await countdown.edit(countdown);
    console.log('倒计时更新成功:', result);
  } catch (error) {
    console.error('倒计时更新失败:', error);
  }
}

【错误处理】
常见错误：
- 无效的事务类型: 使用支持的事务类型
- 缺少必需字段: 确保每个事务都有type和value
- 权限不足: 确认有编辑权限
- 倒计时不存在: 使用有效的objectIdentifier
- 事务格式错误: 检查JSON格式
- 权限值无效: 使用有效的权限PHID或常量
- 时间戳无效: 使用有效的Unix时间戳

【最佳实践】
1. 使用有意义的事务顺序
2. 批量相关事务提高效率
3. 验证事务类型和值
4. 处理权限和验证错误
5. 记录重要的配置变更
6. 合理设置倒计时权限

【性能考虑】
- 批量事务比单个事务更高效
- 避免不必要的事务操作
- 合理设置权限策略
- 考虑事务的原子性

【安全考虑】
- 验证用户权限
- 检查事务类型合法性
- 验证权限值有效性
- 记录重要操作日志
- 避免权限提升攻击

【与倒计时系统的关系】
countdown.edit是倒计时管理系统的核心API：
- 用于创建和修改倒计时
- 支持倒计时权限管理
- 与其他倒计时API配合使用
- 提供倒计时配置管理

【相关API】
countdown.search: 搜索倒计时
其他倒计时相关API

【事务原子性】
- 同一调用中的所有事务原子执行
- 任一事务失败会导致整个操作回滚
- 建议将相关事务放在同一调用中

【版本控制】
- 倒计时变更会被记录
- 支持配置历史追踪
- 可以回滚到之前的版本
- 重要变更建议备份

【权限管理最佳实践】
1. 个人倒计时: 设置为个人用户权限
2. 团队倒计时: 设置为项目权限
3. 公共倒计时: 谨慎设置公开权限
4. 管理倒计时: 限制为管理员权限
5. 定期审查权限设置

【倒计时命名规范】
1. 使用描述性名称
2. 避免特殊字符
3. 保持名称简洁明了
4. 考虑多语言支持
5. 避免名称冲突

【时间戳处理】
1. 使用Unix时间戳格式
2. 考虑时区差异
3. 验证时间戳有效性
4. 提供时间转换工具
5. 记录时区信息

【注意事项】
- transactions必须是有效的JSON数组
- objectIdentifier为空时创建新倒计时
- 事务类型必须受支持
- value类型必须匹配事务类型
- OAuth客户端无法调用此方法
- 返回map<string, wild>类型的数据
- 操作受权限和验证限制影响
- 事务执行是原子的，要么全部成功要么全部失败
- 权限值必须是有效的PHID或常量
- 倒计时名称不能为空
- 时间戳必须是有效的Unix时间戳

【实际应用示例】

创建开发倒计时:
{
  "transactions": [
    {
      "type": "name",
      "value": "Development Sprint Countdown"
    },
    {
      "type": "epoch",
      "value": 1640995200
    },
    {
      "type": "description",
      "value": "Two-week sprint for feature development"
    },
    {
      "type": "projects.add",
      "value": ["PHID-PROJ-DEV"]
    },
    {
      "type": "subscribers.add",
      "value": ["PHID-USER-DEV1", "PHID-USER-DEV2"]
    }
  ]
}

创建发布倒计时:
{
  "transactions": [
    {
      "type": "name",
      "value": "Product Release Countdown"
    },
    {
      "type": "epoch",
      "value": 1641081600
    },
    {
      "type": "description",
      "value": "Major product release deadline"
    },
    {
      "type": "view",
      "value": "public"
    },
    {
      "type": "edit",
      "value": "admin"
    }
  ]
}

权限升级操作:
{
  "objectIdentifier": "PHID-COUNT-1234",
  "transactions": [
    {
      "type": "view",
      "value": "public"
    },
    {
      "type": "edit",
      "value": "PHID-PROJ-1111"
    }
  ]
}

倒计时重命名和日期调整:
{
  "objectIdentifier": "PHID-COUNT-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Updated Countdown Name"
    },
    {
      "type": "epoch",
      "value": 1641168000
    },
    {
      "type": "comment",
      "value": "Updated countdown with new deadline and name."
    }
  ]
}`
      }
    },
  },
  'conpherence.querytransaction': {
    label: 'Conpherence事务查询',
    params: {
      roomID: { type: 'number', default: '', placeholder: '房间ID，可选参数' },
      roomPHID: { type: 'string', default: '', placeholder: '房间PHID，可选参数' },
      limit: { type: 'number', default: '', placeholder: '结果数量限制，可选参数' },
      offset: { type: 'number', default: '', placeholder: '偏移量，可选参数' },
      _help: { 
        type: 'static',
        content: `Conpherence事务查询使用指南:

【API功能】
查询登录用户在特定Conpherence房间内的事务。可以通过ID或PHID指定房间。否则，指定limit和offset来查询登录用户在Conpherence房间内的最新事务。

【参数说明】
- roomID: 房间ID（可选参数）
- roomPHID: 房间PHID（可选参数）
- limit: 结果数量限制（可选参数）
- offset: 偏移量（可选参数）

【参数详解】

1. roomID（可选）
   - 类型: int
   - 说明: 房间的数字ID
   - 默认值: 空
   - 示例: 123
   - 注意: 与roomPHID二选一使用

2. roomPHID（可选）
   - 类型: phid
   - 说明: 房间的PHID标识符
   - 默认值: 空
   - 示例: "PHID-ROOM-1111"
   - 注意: 与roomID二选一使用

3. limit（可选）
   - 类型: int
   - 说明: 返回结果的数量限制
   - 默认值: 空
   - 示例: 50
   - 注意: 控制返回的事务数量

4. offset（可选）
   - 类型: int
   - 说明: 结果偏移量，用于分页
   - 默认值: 空
   - 示例: 100
   - 注意: 与limit配合使用进行分页

【使用场景】
- 查询特定房间的消息历史
- 获取用户参与的讨论组事务
- 分页浏览大量消息
- 监控房间活动
- 获取最新消息
- 分析对话历史

【操作示例】

按房间ID查询:
{
  "roomID": 123
}

按房间PHID查询:
{
  "roomPHID": "PHID-ROOM-1111"
}

限制结果数量:
{
  "roomID": 123,
  "limit": 50
}

分页查询:
{
  "roomID": 123,
  "limit": 50,
  "offset": 100
}

查询最新事务:
{
  "limit": 20,
  "offset": 0
}

【参数组合说明】

1. 指定房间查询:
   - 必须提供roomID或roomPHID之一
   - 可以配合limit和offset使用
   - 返回指定房间的事务

2. 全局查询:
   - 不提供roomID和roomPHID
   - 必须提供limit和offset
   - 返回用户所有房间的最新事务

3. 分页查询:
   - 使用offset跳过指定数量的事务
   - 使用limit控制返回数量
   - 适用于大量数据的分页处理

【返回信息】
成功时返回非空字典，包含：
- 事务列表
- 事务详情
- 分页信息
- 房间信息

【错误处理】
常见错误：
- ERR_USAGE_NO_ROOM_ID: 必须指定房间ID或房间PHID来查询事务
- ERR-CONDUIT-CORE: 核心错误，详见错误消息
- 权限不足: 无法访问指定房间
- 参数无效: 房间ID或PHID不存在
- 分页参数错误: limit或offset值无效

【最佳实践】
1. 使用roomPHID而不是roomID（更稳定）
2. 合理设置limit避免过多数据
3. 使用offset进行分页查询
4. 缓存房间信息减少查询
5. 处理权限错误和房间不存在的情况

【性能考虑】
- 限制查询结果数量提高响应速度
- 避免查询过于久远的历史记录
- 合理使用分页减少单次查询负担
- 考虑缓存频繁查询的房间信息

【安全考虑】
- OAuth客户端无法调用此方法
- 只能查询用户有权限访问的房间
- 返回数据受权限策略限制
- 记录重要查询操作

【与Conpherence系统的关系】
conpherence.querytransaction是Conpherence消息系统的核心API：
- 用于查询房间消息历史
- 支持分页浏览大量消息
- 与其他Conpherence API配合使用
- 提供消息事务的详细信息

【相关API】
conpherence.updatethread: 更新线程
conpherence.joinroom: 加入房间
conpherence.leaveroom: 离开房间
其他Conpherence相关API

【分页查询示例】
// 第一页
{
  "roomID": 123,
  "limit": 50,
  "offset": 0
}

// 第二页
{
  "roomID": 123,
  "limit": 50,
  "offset": 50
}

// 第三页
{
  "roomID": 123,
  "limit": 50,
  "offset": 100
}

【实际应用场景】

查询项目讨论组消息:
{
  "roomPHID": "PHID-ROOM-PROJECT1",
  "limit": 100,
  "offset": 0
}

获取用户最新消息:
{
  "limit": 20,
  "offset": 0
}

分页浏览历史消息:
{
  "roomID": 456,
  "limit": 50,
  "offset": 200
}

【批量操作示例】:
const rooms = [
  { roomPHID: "PHID-ROOM-1111", limit: 50 },
  { roomPHID: "PHID-ROOM-2222", limit: 50 },
  { roomPHID: "PHID-ROOM-3333", limit: 50 }
];

for (const room of rooms) {
  try {
    const result = await conpherence.querytransaction(room);
    console.log('房间消息查询成功:', result);
  } catch (error) {
    console.error('房间消息查询失败:', error);
  }
}

【事务类型】
返回的事务可能包含：
- 消息内容
- 用户操作
- 房间变更
- 文件分享
- 用户加入/离开
- 其他活动记录

【数据结构】
返回的数据结构通常包含：
- 事务ID
- 事务类型
- 创建时间
- 作者信息
- 事务内容
- 相关元数据

【注意事项】
- roomID和roomPHID必须至少提供一个
- 不提供房间标识时必须提供limit和offset
- OAuth客户端无法调用此方法
- 返回nonempty dict类型的数据
- 操作受权限和验证限制影响
- 只能查询用户有权限的房间事务
- 大量数据查询建议使用分页

【实际应用示例】

查询特定房间最近消息:
{
  "roomPHID": "PHID-ROOM-TEAM-DISCUSSION",
  "limit": 30,
  "offset": 0
}

分页获取完整历史:
{
  "roomID": 789,
  "limit": 100,
  "offset": 0
}

获取用户所有房间的最新活动:
{
  "limit": 50,
  "offset": 0
}

查询项目相关讨论:
{
  "roomPHID": "PHID-ROOM-PROJECT-ALPHA",
  "limit": 200,
  "offset": 0
}

监控房间活动:
{
  "roomID": 101,
  "limit": 10,
  "offset": 0
}

【权限说明】
- 用户必须是房间成员才能查询事务
- 私有房间需要明确权限
- 公开房间可能有限制
- 管理员可以查询更多房间
- 权限不足会返回错误

【性能优化建议】
1. 使用合适的limit值
2. 避免查询过于久远的历史
3. 缓存频繁查询的房间
4. 使用roomPHID而非roomID
5. 合理设置分页大小

【常见用例】
- 聊天应用的消息历史
- 项目讨论的记录查询
- 团队沟通的日志分析
- 客服对话的历史回溯
- 会议记录的查询展示`
      }
    },
  },
  'conpherence.querythread': {
    label: 'Conpherence线程查询',
    params: {
      ids: { type: 'json', default: '[]', placeholder: '线程ID数组，可选参数' },
      phids: { type: 'json', default: '[]', placeholder: '线程PHID数组，可选参数' },
      limit: { type: 'number', default: '', placeholder: '结果数量限制，可选参数' },
      offset: { type: 'number', default: '', placeholder: '偏移量，可选参数' },
      _help: { 
        type: 'static',
        content: `Conpherence线程查询使用指南:

【API功能】
查询登录用户的Conpherence线程。可以通过ID或PHID查询特定的Conpherence线程。否则，指定limit和offset来查询登录用户最近更新的Conpherence线程。

【参数说明】
- ids: 线程ID数组（可选参数）
- phids: 线程PHID数组（可选参数）
- limit: 结果数量限制（可选参数）
- offset: 偏移量（可选参数）

【参数详解】

1. ids（可选）
   - 类型: array<int>
   - 说明: 线程的数字ID数组
   - 默认值: []
   - 示例: [123, 456, 789]
   - 注意: 与phids二选一使用

2. phids（可选）
   - 类型: array<phids>
   - 说明: 线程的PHID标识符数组
   - 默认值: []
   - 示例: ["PHID-THREAD-1111", "PHID-THREAD-2222"]
   - 注意: 与ids二选一使用

3. limit（可选）
   - 类型: int
   - 说明: 返回结果的数量限制
   - 默认值: 空
   - 示例: 50
   - 注意: 控制返回的线程数量

4. offset（可选）
   - 类型: int
   - 说明: 结果偏移量，用于分页
   - 默认值: 空
   - 示例: 100
   - 注意: 与limit配合使用进行分页

【使用场景】
- 查询特定线程的信息
- 获取用户参与的所有线程
- 分页浏览大量线程
- 监控线程活动
- 获取最新更新的线程
- 分析对话模式

【操作示例】

按线程ID查询:
{
  "ids": [123, 456, 789]
}

按线程PHID查询:
{
  "phids": ["PHID-THREAD-1111", "PHID-THREAD-2222"]
}

限制结果数量:
{
  "limit": 50
}

分页查询:
{
  "limit": 50,
  "offset": 100
}

查询最新线程:
{
  "limit": 20,
  "offset": 0
}

【参数组合说明】

1. 指定线程查询:
   - 必须提供ids或phids之一
   - 可以配合limit和offset使用
   - 返回指定线程的信息

2. 全局查询:
   - 不提供ids和phids
   - 必须提供limit和offset
   - 返回用户所有线程，按更新时间排序

3. 分页查询:
   - 使用offset跳过指定数量的线程
   - 使用limit控制返回数量
   - 适用于大量线程的分页处理

【返回信息】
成功时返回非空字典，包含：
- 线程列表
- 线程详情
- 分页信息
- 参与者信息
- 消息统计

【错误处理】
常见错误：
- ERR-CONDUIT-CORE: 核心错误，详见错误消息
- 权限不足: 无法访问指定线程
- 参数无效: 线程ID或PHID不存在
- 分页参数错误: limit或offset值无效
- 线程不存在: 指定的线程不存在或已删除

【最佳实践】
1. 使用phids而不是ids（更稳定）
2. 合理设置limit避免过多数据
3. 使用offset进行分页查询
4. 缓存线程信息减少查询
5. 处理权限错误和线程不存在的情况

【性能考虑】
- 限制查询结果数量提高响应速度
- 避免查询过于久远的线程历史
- 合理使用分页减少单次查询负担
- 考虑缓存频繁查询的线程信息

【安全考虑】
- OAuth客户端无法调用此方法
- 只能查询用户有权限访问的线程
- 返回数据受权限策略限制
- 记录重要查询操作

【与Conpherence系统的关系】
conpherence.querythread是Conpherence消息系统的核心API：
- 用于查询线程信息和元数据
- 支持分页浏览大量线程
- 与其他Conpherence API配合使用
- 提供线程的详细统计信息

【相关API】
conpherence.querytransaction: 查询线程事务
conpherence.updatethread: 更新线程
conpherence.joinroom: 加入房间
conpherence.leaveroom: 离开房间
其他Conpherence相关API

【分页查询示例】
// 第一页
{
  "limit": 50,
  "offset": 0
}

// 第二页
{
  "limit": 50,
  "offset": 50
}

// 第三页
{
  "limit": 50,
  "offset": 100
}

【实际应用场景】

查询项目讨论线程:
{
  "phids": ["PHID-THREAD-PROJECT1", "PHID-THREAD-PROJECT2"],
  "limit": 100
}

获取用户最新线程:
{
  "limit": 20,
  "offset": 0
}

分页浏览所有线程:
{
  "limit": 50,
  "offset": 200
}

【批量操作示例】:
const threadQueries = [
  { phids: ["PHID-THREAD-1111"], limit: 50 },
  { phids: ["PHID-THREAD-2222"], limit: 50 },
  { phids: ["PHID-THREAD-3333"], limit: 50 }
];

for (const query of threadQueries) {
  try {
    const result = await conpherence.querythread(query);
    console.log('线程查询成功:', result);
  } catch (error) {
    console.error('线程查询失败:', error);
  }
}

【线程信息】
返回的线程信息可能包含：
- 线程ID和PHID
- 线程标题
- 参与者列表
- 消息数量
- 最后更新时间
- 未读消息数量
- 线程类型和状态

【数据结构】
返回的数据结构通常包含：
- threadID: 线程ID
- phid: 线程PHID
- title: 线程标题
- participants: 参与者信息
- messageCount: 消息数量
- dateModified: 最后修改时间
- unreadCount: 未读消息数
- threadType: 线程类型

【注意事项】
- ids和phids必须至少提供一个（全局查询时除外）
- 不提供线程标识时必须提供limit和offset
- OAuth客户端无法调用此方法
- 返回nonempty dict类型的数据
- 操作受权限和验证限制影响
- 只能查询用户有权限的线程
- 大量数据查询建议使用分页

【实际应用示例】

查询特定线程信息:
{
  "phids": ["PHID-THREAD-TEAM-DISCUSSION"],
  "limit": 30
}

分页获取所有线程:
{
  "limit": 100,
  "offset": 0
}

获取用户最新活动线程:
{
  "limit": 50,
  "offset": 0
}

查询项目相关线程:
{
  "phids": ["PHID-THREAD-PROJECT-ALPHA", "PHID-THREAD-PROJECT-BETA"],
  "limit": 200
}

监控线程活动:
{
  "limit": 10,
  "offset": 0
}

【权限说明】
- 用户必须是线程参与者才能查询详细信息
- 私有线程需要明确权限
- 公开线程可能有限制
- 管理员可以查询更多线程
- 权限不足会返回错误

【性能优化建议】
1. 使用合适的limit值
2. 避免查询过于久远的线程
3. 缓存频繁查询的线程
4. 使用phids而非ids
5. 合理设置分页大小

【常见用例】
- 聊天应用的线程列表
- 项目讨论的线程管理
- 团队沟通的线程监控
- 客服对话的线程跟踪
- 会议记录的线程查询

【线程类型】
可能返回的线程类型：
- 私人对话
- 群组讨论
- 项目讨论
- 会议记录
- 公告通知
- 其他自定义类型

【排序规则】
全局查询时的排序：
- 按最后更新时间降序排列
- 最新更新的线程排在前面
- 相同更新时间的线程按ID排序

【统计信息】
返回的统计信息可能包括：
- 总消息数量
- 未读消息数量
- 参与者数量
- 活跃度指标
- 交互频率

【实际应用示例】

查询团队讨论线程:
{
  "phids": ["PHID-THREAD-TEAM-MAIN", "PHID-THREAD-TECH-CHAT"],
  "limit": 100
}

获取用户所有活跃线程:
{
  "limit": 50,
  "offset": 0
}

分页浏览历史线程:
{
  "limit": 100,
  "offset": 500
}

监控重要线程:
{
  "phids": ["PHID-THREAD-CRITICAL", "PHID-THREAD-URGENT"],
  "limit": 10
}

批量查询项目线程:
{
  "phids": [
    "PHID-THREAD-PROJECT-A",
    "PHID-THREAD-PROJECT-B",
    "PHID-THREAD-PROJECT-C"
  ],
  "limit": 200
}

【高级用法】
结合其他API使用：
1. 先查询线程列表
2. 再查询具体线程的事务
3. 获取完整的对话历史

【缓存策略】
- 缓存频繁访问的线程信息
- 定期更新线程状态
- 合理设置缓存过期时间
- 避免重复查询相同数据

【错误恢复】
- 处理网络超时
- 重试失败的查询
- 记录错误日志
- 提供降级方案

【监控指标】
- 查询响应时间
- 数据传输量
- 错误率统计
- 用户活跃度

【特色功能】
- 灵活的线程标识方式（ID或PHID）
- 完整的分页支持
- 权限控制机制
- 详细的线程统计
- 高效的查询性能
- 全局和特定线程查询模式

【安全限制】
- OAuth客户端无法调用此方法
- 返回nonempty dict类型的数据
- 操作受权限和验证限制影响
- 只能查询用户有权限的线程`
      }
    },
  },
  'conpherence.edit': {
    label: 'Conpherence编辑',
    params: {
      transactions: { type: 'json', default: '[]', placeholder: '事务列表，见下方详细说明' },
      objectIdentifier: { type: 'string', default: '', placeholder: '房间ID或PHID，留空创建新房间' },
      _help: { 
        type: 'static',
        content: `Conpherence编辑使用指南:

【API功能】
标准的ApplicationEditor方法，用于通过应用事务来创建和修改Conpherence房间对象。

【参数说明】
- transactions: 事务列表（必需参数）
- objectIdentifier: 房间ID或PHID（可选参数，留空创建新房间）

【参数详解】

1. transactions（必需）
   - 类型: list<map<string, wild>>
   - 说明: 要应用的事务列表
   - 示例: [{"type": "name", "value": "New Room"}]
   - 注意: 必须是有效的事务数组

2. objectIdentifier（可选）
   - 类型: id|phid|string
   - 说明: 要编辑的房间ID或PHID，留空创建新房间
   - 示例: "123", "PHID-ROOM-1111", "room-name"
   - 注意: 创建新房时时留空

【事务类型】
支持以下类型的事务：

1. comment: 添加评论
   - 类型: const
   - 值: string
   - 说明: 要添加的评论，格式化为remarkup

2. name: 房间名称
   - 类型: const
   - 值: string
   - 说明: 新房间名称

3. topic: 房间主题
   - 类型: const
   - 值: string
   - 说明: 新房间主题

4. participants.add: 添加房间参与者
   - 类型: const
   - 值: list<user>
   - 说明: 要添加的PHID列表

5. participants.remove: 移除房间参与者
   - 类型: const
   - 值: list<user>
   - 说明: 要移除的PHID列表

6. participants.set: 设置房间参与者
   - 类型: const
   - 值: list<user>
   - 说明: 要设置的PHID列表

7. view: 更改对象的查看策略
   - 类型: const
   - 值: string
   - 说明: 新策略PHID或常量

8. edit: 更改对象的编辑策略
   - 类型: const
   - 值: string
   - 说明: 新策略PHID或常量

【使用场景】
- 创建新的讨论房间
- 修改现有房间的名称和主题
- 管理房间参与者
- 添加评论和讨论
- 设置房间权限
- 更新房间配置

【操作示例】

创建新房间:
{
  "transactions": [
    {
      "type": "name",
      "value": "Team Discussion"
    },
    {
      "type": "topic",
      "value": "General team discussions and updates"
    }
  ]
}

修改房间名称:
{
  "objectIdentifier": "PHID-ROOM-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Updated Room Name"
    }
  ]
}

更改房间主题:
{
  "objectIdentifier": "PHID-ROOM-1234",
  "transactions": [
    {
      "type": "topic",
      "value": "New room topic for focused discussion"
    }
  ]
}

添加参与者:
{
  "objectIdentifier": "PHID-ROOM-1234",
  "transactions": [
    {
      "type": "participants.add",
      "value": ["PHID-USER-1111", "PHID-USER-2222"]
    }
  ]
}

移除参与者:
{
  "objectIdentifier": "PHID-ROOM-1234",
  "transactions": [
    {
      "type": "participants.remove",
      "value": ["PHID-USER-1111"]
    }
  ]
}

设置参与者:
{
  "objectIdentifier": "PHID-ROOM-1234",
  "transactions": [
    {
      "type": "participants.set",
      "value": ["PHID-USER-3333", "PHID-USER-4444"]
    }
  ]
}

添加评论:
{
  "objectIdentifier": "PHID-ROOM-1234",
  "transactions": [
    {
      "type": "comment",
      "value": "This is an important update for the team."
    }
  ]
}

更改查看权限:
{
  "objectIdentifier": "PHID-ROOM-1234",
  "transactions": [
    {
      "type": "view",
      "value": "public"
    }
  ]
}

更改编辑权限:
{
  "objectIdentifier": "PHID-ROOM-1234",
  "transactions": [
    {
      "type": "edit",
      "value": "admin"
    }
  ]
}

批量修改房间:
{
  "objectIdentifier": "PHID-ROOM-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Comprehensive Room Update"
    },
    {
      "type": "topic",
      "value": "Updated topic with new focus"
    },
    {
      "type": "participants.add",
      "value": ["PHID-USER-1111"]
    },
    {
      "type": "view",
      "value": "public"
    }
  ]
}

【事务格式详解】

每个事务对象包含以下字段：
- type: 事务类型（必需）
- value: 事务值（必需，类型根据事务类型而定）

事务类型详细说明：

1. comment事务:
{
  "type": "comment",
  "value": "This is a remarkup formatted comment."
}

- 说明: 添加评论
- 值类型: string
- 格式: remarkup格式

2. name事务:
{
  "type": "name",
  "value": "My Room Name"
}

- 说明: 设置房间名称
- 值类型: string
- 示例: "Team Chat", "Project Discussion"

3. topic事务:
{
  "type": "topic",
  "value": "Room topic description"
}

- 说明: 设置房间主题
- 值类型: string
- 格式: remarkup格式

4. participants.add事务:
{
  "type": "participants.add",
  "value": ["PHID-USER-1111", "PHID-USER-2222"]
}

- 说明: 添加房间参与者
- 值类型: list<user>
- 示例: 用户PHID列表

5. participants.remove事务:
{
  "type": "participants.remove",
  "value": ["PHID-USER-1111"]
}

- 说明: 移除房间参与者
- 值类型: list<user>
- 示例: 要移除的用户PHID列表

6. participants.set事务:
{
  "type": "participants.set",
  "value": ["PHID-USER-3333"]
}

- 说明: 设置房间参与者，覆盖当前值
- 值类型: list<user>
- 示例: 要设置的用户PHID列表

7. view事务:
{
  "type": "view",
  "value": "public"
}

- 说明: 更改查看权限
- 值类型: string
- 权限选项:
  - public: 公开访问
  - admin: 仅管理员
  - 用户PHID: 特定用户
  - 项目PHID: 特定项目成员

8. edit事务:
{
  "type": "edit",
  "value": "admin"
}

- 说明: 更改编辑权限
- 值类型: string
- 权限选项:
  - public: 公开编辑
  - admin: 仅管理员编辑
  - 用户PHID: 特定用户编辑
  - 项目PHID: 特定项目成员编辑

【返回信息】
成功时返回包含以下信息的映射：
- id: 房间ID
- phid: 房间PHID
- name: 房间名称
- topic: 房间主题
- participants: 参与者列表
- 其他更新后的字段信息

【使用流程】
1. 确定操作类型（创建或编辑）
2. 准备事务列表
3. 设置objectIdentifier（编辑时）或留空（创建时）
4. 执行编辑操作
5. 处理返回结果

【实际应用场景】

创建项目讨论房间:
{
  "transactions": [
    {
      "type": "name",
      "value": "Project Alpha Discussion"
    },
    {
      "type": "topic",
      "value": "Discussion room for Project Alpha development"
    },
    {
      "type": "participants.add",
      "value": ["PHID-USER-TEAM1", "PHID-USER-TEAM2"]
    }
  ]
}

更新房间配置:
{
  "objectIdentifier": "PHID-ROOM-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Updated Room Name"
    },
    {
      "type": "topic",
      "value": "New topic description"
    },
    {
      "type": "comment",
      "value": "Room configuration has been updated."
    }
  ]
}

权限升级操作:
{
  "objectIdentifier": "PHID-ROOM-1234",
  "transactions": [
    {
      "type": "view",
      "value": "public"
    },
    {
      "type": "edit",
      "value": "PHID-PROJ-1111"
    }
  ]
}

批量操作示例:
const rooms = [
  {
    objectIdentifier: "PHID-ROOM-1111",
    transactions: [{"type": "name", "value": "Updated Room 1"}]
  },
  {
    objectIdentifier: "PHID-ROOM-2222", 
    transactions: [{"type": "topic", "value": "New Topic"}]
  }
];

for (const room of rooms) {
  try {
    const result = await conpherence.edit(room);
    console.log('房间更新成功:', result);
  } catch (error) {
    console.error('房间更新失败:', error);
  }
}

【错误处理】
常见错误：
- 无效的事务类型: 使用支持的事务类型
- 缺少必需字段: 确保每个事务都有type和value
- 权限不足: 确认有编辑权限
- 房间不存在: 使用有效的objectIdentifier
- 事务格式错误: 检查JSON格式
- 权限值无效: 使用有效的权限PHID或常量
- 参与者PHID无效: 使用有效的用户PHID

【最佳实践】
1. 使用有意义的事务顺序
2. 批量相关事务提高效率
3. 验证事务类型和值
4. 处理权限和验证错误
5. 记录重要的配置变更
6. 合理设置房间权限

【性能考虑】
- 批量事务比单个事务更高效
- 避免不必要的事务操作
- 合理设置权限策略
- 考虑事务的原子性

【安全考虑】
- 验证用户权限
- 检查事务类型合法性
- 验证权限值有效性
- 验证参与者PHID有效性
- 记录重要操作日志
- 避免权限提升攻击

【与Conpherence系统的关系】
conpherence.edit是Conpherence消息系统的核心API：
- 用于创建和修改房间
- 支持房间权限管理
- 与其他Conpherence API配合使用
- 提供房间配置管理

【相关API】
conpherence.querythread: 查询线程
conpherence.querytransaction: 查询事务
conpherence.joinroom: 加入房间
conpherence.leaveroom: 离开房间
其他Conpherence相关API

【事务原子性】
- 同一调用中的所有事务原子执行
- 任一事务失败会导致整个操作回滚
- 建议将相关事务放在同一调用中

【版本控制】
- 房间变更会被记录
- 支持配置历史追踪
- 可以回滚到之前的版本
- 重要变更建议备份

【权限管理最佳实践】
1. 私人房间: 设置为个人用户权限
2. 团队房间: 设置为项目权限
3. 公共房间: 谨慎设置公开权限
4. 管理房间: 限制为管理员权限
5. 定期审查权限设置

【房间命名规范】
1. 使用描述性名称
2. 避免特殊字符
3. 保持名称简洁明了
4. 考虑多语言支持
5. 避免名称冲突

【参与者管理】
1. 添加相关团队成员
2. 定期清理不活跃参与者
3. 设置合理的参与者数量限制
4. 记录参与者变更历史
5. 提供参与者权限说明

【注意事项】
- transactions必须是有效的JSON数组
- objectIdentifier为空时创建新房间
- 事务类型必须受支持
- value类型必须匹配事务类型
- OAuth客户端无法调用此方法
- 返回map<string, wild>类型的数据
- 操作受权限和验证限制影响
- 事务执行是原子的，要么全部成功要么全部失败
- 权限值必须是有效的PHID或常量
- 房间名称不能为空
- 参与者PHID必须是有效的用户PHID

【实际应用示例】

创建团队讨论房间:
{
  "transactions": [
    {
      "type": "name",
      "value": "Development Team Chat"
    },
    {
      "type": "topic",
      "value": "Daily development discussions and coordination"
    },
    {
      "type": "participants.add",
      "value": ["PHID-USER-DEV1", "PHID-USER-DEV2", "PHID-USER-DEV3"]
    }
  ]
}

创建项目专用房间:
{
  "transactions": [
    {
      "type": "name",
      "value": "Project Beta Room"
    },
    {
      "type": "topic",
      "value": "Dedicated room for Project Beta discussions"
    },
    {
      "type": "view",
      "value": "PHID-PROJ-BETA"
    },
    {
      "type": "edit",
      "value": "PHID-PROJ-BETA"
    }
  ]
}

更新房间信息:
{
  "objectIdentifier": "PHID-ROOM-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Updated Room Name"
    },
    {
      "type": "topic",
      "value": "Updated topic with new focus area"
    },
    {
      "type": "comment",
      "value": "Room has been updated with new configuration."
    }
  ]
}

权限升级操作:
{
  "objectIdentifier": "PHID-ROOM-1234",
  "transactions": [
    {
      "type": "view",
      "value": "public"
    },
    {
      "type": "edit",
      "value": "PHID-PROJ-1111"
    }
  ]
}

参与者管理操作:
{
  "objectIdentifier": "PHID-ROOM-1234",
  "transactions": [
    {
      "type": "participants.add",
      "value": ["PHID-USER-NEW1", "PHID-USER-NEW2"]
    },
    {
      "type": "participants.remove",
      "value": ["PHID-USER-OLD1"]
    },
    {
      "type": "comment",
      "value": "Updated room participants."
    }
  ]
}

【特色功能】
- 完整的ApplicationEditor标准实现
- 8种事务类型支持
- 灵活的权限管理
- 参与者管理
- 评论功能
- 原子性事务执行
- 详细的操作日志

【安全限制】
- OAuth客户端无法调用此方法
- 返回map<string, wild>类型的数据
- 操作受权限和验证限制影响
- 事务执行是原子的，要么全部成功要么全部失败
- 权限值必须是有效的PHID或常量
- 房间名称不能为空
- 参与者PHID必须是有效的用户PHID`
      }
    },
  },
  'calendar.event.search': {
    label: '日历事件搜索',
    params: {
      queryKey: { type: 'string', default: '', placeholder: '查询类型：month/day/upcoming/all' },
      constraints: { type: 'json', default: '{}', placeholder: '约束条件，见下方常用示例' },
      attachments: { type: 'json', default: '{}', placeholder: '附加信息，如：{"subscribers":true,"projects":true}' },
      order: { type: 'string', default: 'start', placeholder: '排序：start/newest/oldest/relevance' },
      before: { type: 'string', default: '', placeholder: '分页游标，获取前一页' },
      after: { type: 'string', default: '', placeholder: '分页游标，获取后一页' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制，默认100' },
      _help: { 
        type: 'static',
        content: `日历事件搜索使用指南:

【API功能】
标准的ApplicationSearch方法，用于列出、查询或搜索日历事件对象。支持内置查询、自定义约束、排序、附件和分页功能。

【参数说明】
- queryKey: 查询类型（可选参数）
- constraints: 约束条件（可选参数）
- attachments: 附加信息（可选参数）
- order: 排序方式（可选参数）
- before: 分页游标，获取前一页（可选参数）
- after: 分页游标，获取后一页（可选参数）
- limit: 结果数量限制（可选参数，默认100）

【参数详解】

1. queryKey（可选）
   - 类型: string
   - 说明: 内置或保存的查询键
   - 默认值: 空
   - 示例: "month", "day", "upcoming", "all"
   - 注意: 如果不指定，查询将从无约束开始

2. constraints（可选）
   - 类型: map<string, wild>
   - 说明: 自定义约束条件字典
   - 默认值: {}
   - 示例: {"authors": ["PHID-USER-1111"], "statuses": ["open"]}
   - 注意: 与queryKey结合使用时，会覆盖默认约束

3. attachments（可选）
   - 类型: map<string, bool>
   - 说明: 请求额外信息
   - 默认值: {}
   - 示例: {"subscribers": true, "projects": true}
   - 注意: 请求更多信息会降低查询性能

4. order（可选）
   - 类型: order
   - 说明: 结果排序方式
   - 默认值: start
   - 示例: "start", "newest", "oldest", "relevance"
   - 注意: 可以使用内置键或自定义列排序

5. before（可选）
   - 类型: string
   - 说明: 分页游标，获取前一页
   - 默认值: 空
   - 示例: "1234"
   - 注意: 与after配合使用进行分页

6. after（可选）
   - 类型: string
   - 说明: 分页游标，获取后一页
   - 默认值: 空
   - 示例: "4567"
   - 注意: 与before配合使用进行分页

7. limit（可选）
   - 类型: int
   - 说明: 结果数量限制
   - 默认值: 100
   - 示例: 50
   - 注意: 最大100，需要更多结果时使用分页

【内置查询类型】
支持以下内置查询键：

1. month: 月视图
   - 说明: 显示当前月份的事件
   - 适用场景: 月度日历查看

2. day: 日视图
   - 说明: 显示当天的事件
   - 适用场景: 日程安排查看

3. upcoming: 即将到来的事件
   - 说明: 显示未来的事件
   - 适用场景: 即将到来的活动

4. all: 全部事件
   - 说明: 显示所有事件
   - 适用场景: 完整事件列表

【约束类型】
支持以下约束键：

1. ids: ID列表
   - 类型: list<int>
   - 说明: 搜索特定ID的对象
   - 示例: [123, 456, 789]

2. phids: PHID列表
   - 类型: list<phid>
   - 说明: 搜索特定PHID的对象
   - 示例: ["PHID-EVNT-1111", "PHID-EVNT-2222"]

3. hostPHIDs: 主机
   - 类型: list<string>
   - 说明: 事件主机PHID列表
   - 示例: ["PHID-USER-1111"]

4. invitedPHIDs: 被邀请者
   - 类型: list<string>
   - 说明: 被邀请用户PHID列表
   - 示例: ["PHID-USER-2222"]

5. rangeStart: 开始时间之后
   - 类型: 
   - 说明: 指定时间之后的事件
   - 注意: 不支持

6. rangeEnd: 结束时间之前
   - 类型: 
   - 说明: 指定时间之前的事件
   - 注意: 不支持

7. upcoming: 即将到来
   - 类型: list<string>
   - 说明: 即将到来的事件
   - 示例: ["true"]

8. isCancelled: 已取消事件
   - 类型: 
   - 说明: 已取消的事件
   - 注意: 不支持

9. importSourcePHIDs: 导入源
   - 类型: list<phid>
   - 说明: 导入源PHID列表
   - 示例: ["PHID-IMPT-1111"]

10. display: 显示选项
    - 类型: 
    - 说明: 显示选项
    - 注意: 不支持

11. query: 查询
    - 类型: string
    - 说明: 全文搜索
    - 示例: "meeting"

12. subscribers: 订阅者
    - 类型: list<user>
    - 说明: 具有特定订阅者的对象
    - 示例: ["PHID-USER-1111"]

13. projects: 项目标签
    - 类型: list<project>
    - 说明: 标记有给定项目的对象
    - 示例: ["PHID-PROJ-1111"]

14. spaces: 空间
    - 类型: list<phid>
    - 说明: 特定空间中的对象
    - 示例: ["PHID-SPCE-1111"]

【排序选项】
支持以下内置排序：

1. start: 事件开始时间
   - 说明: 按事件开始时间排序
   - 列: start, id

2. newest: 创建日期（最新的优先）
   - 说明: 按创建时间降序排列
   - 列: id

3. oldest: 创建日期（最旧的优先）
   - 说明: 按创建时间升序排列
   - 列: -id

4. relevance: 相关性
   - 说明: 按相关性排序
   - 列: rank, fulltext-modified, id

【低级排序列】
支持以下低级排序列：

1. start: 事件开始时间
   - 唯一: 否

2. id: ID
   - 唯一: 是

3. rank: 排名
   - 唯一: 否

4. fulltext-created: 全文创建时间
   - 唯一: 否

5. fulltext-modified: 全文修改时间
   - 唯一: 否

【对象字段】
返回的对象包含以下字段：

1. name: 事件名称
   - 类型: string
   - 说明: 事件的名称

2. description: 事件描述
   - 类型: string
   - 说明: 事件的描述

3. isAllDay: 全天事件
   - 类型: bool
   - 说明: 如果事件是全天事件则为true

4. startDateTime: 开始日期时间
   - 类型: datetime
   - 说明: 事件的开始日期和时间

5. endDateTime: 结束日期时间
   - 类型: datetime
   - 说明: 事件的结束日期和时间

6. spacePHID: 策略空间PHID
   - 类型: phid?
   - 说明: 此对象所属的策略空间PHID

7. dateCreated: 创建日期
   - 类型: int
   - 说明: 对象创建时的纪元时间戳

8. dateModified: 修改日期
   - 类型: int
   - 说明: 对象最后更新时的纪元时间戳

9. policy: 策略
   - 类型: map<string, wild>
   - 说明: 从功能到当前策略的映射

【附加信息】
支持以下附加信息：

1. subscribers: 订阅者
   - 说明: 获取订阅者信息
   - 返回: subscriberPHIDs, subscriberCount, viewerIsSubscribed

2. projects: 项目
   - 说明: 获取项目信息
   - 返回: projectPHIDs, projectCount

【分页和限制】
- 查询限制为每次返回100个结果
- 使用limit指定较小的限制
- 使用before和after游标进行分页
- cursor包含分页信息

【使用场景】
- 查询特定日期范围的事件
- 搜索特定用户的事件
- 获取即将到来的活动
- 按项目筛选事件
- 分页浏览大量事件
- 获取事件详细信息

【操作示例】

使用内置查询:
{
  "queryKey": "upcoming"
}

自定义约束:
{
  "constraints": {
    "authors": ["PHID-USER-1111"],
    "projects": ["PHID-PROJ-1111"]
  }
}

请求附加信息:
{
  "attachments": {
    "subscribers": true,
    "projects": true
  }
}

排序结果:
{
  "order": "start"
}

分页查询:
{
  "limit": 50,
  "after": "1234"
}

完整查询示例:
{
  "queryKey": "upcoming",
  "constraints": {
    "authors": ["PHID-USER-1111"],
    "projects": ["PHID-PROJ-1111"]
  },
  "attachments": {
    "subscribers": true
  },
  "order": "start",
  "limit": 50
}

【返回信息】
成功时返回map<string, wild>，包含：
- data: 事件列表
- cursor: 分页信息
- 其他元数据

【错误处理】
常见错误：
- ERR-CONDUIT-CORE: 核心错误，详见错误消息
- 权限不足: 无法访问指定事件
- 参数无效: 约束条件格式错误
- 分页错误: 游标无效

【最佳实践】
1. 使用合适的queryKey提高查询效率
2. 合理设置limit避免过多数据
3. 只请求需要的attachments
4. 使用分页处理大量结果
5. 结合约束条件精确筛选

【性能考虑】
- 限制结果数量提高响应速度
- 谨慎使用attachments
- 合理使用约束条件
- 考虑缓存频繁查询

【安全考虑】
- OAuth客户端无法调用此方法
- 只能查询用户有权限的事件
- 返回数据受权限策略限制
- 记录重要查询操作

【与日历系统的关系】
calendar.event.search是日历系统的核心API：
- 用于查询和管理日历事件
- 支持多种查询和筛选方式
- 与其他日历API配合使用
- 提供完整的事件信息

【相关API】
calendar.event.edit: 编辑事件
calendar.event.create: 创建事件
其他日历相关API

【分页示例】
// 第一页
{
  "limit": 50,
  "after": ""
}

// 第二页
{
  "limit": 50,
  "after": "1234"
}

// 第三页
{
  "limit": 50,
  "after": "5678"
}

【实际应用场景】
查询月度事件:
{
  "queryKey": "month",
  "attachments": {
    "subscribers": true
  }
}

查询用户事件:
{
  "constraints": {
    "authors": ["PHID-USER-1111"]
  },
  "order": "start"
}

查询项目事件:
{
  "constraints": {
    "projects": ["PHID-PROJ-1111"]
  },
  "attachments": {
    "projects": true
  }
}

搜索事件:
{
  "constraints": {
    "query": "meeting"
  },
  "order": "relevance"
}

【批量操作示例】:
const queries = [
  {
    queryKey: "upcoming",
    limit: 50
  },
  {
    constraints: { authors: ["PHID-USER-1111"] },
    limit: 50
  },
  {
    constraints: { projects: ["PHID-PROJ-1111"] },
    limit: 50
  }
];

for (const query of queries) {
  try {
    const result = await calendar.event.search(query);
    console.log('事件查询成功:', result);
  } catch (error) {
    console.error('事件查询失败:', error);
  }
}

【自定义排序示例】:
// 按开始时间排序
{
  "order": "start"
}

// 按创建时间排序（最新的优先）
{
  "order": "newest"
}

// 自定义列排序
{
  "order": ["start", "-id"]
}

【约束组合示例】:
{
  "constraints": {
    "authors": ["PHID-USER-1111"],
    "projects": ["PHID-PROJ-1111"],
    "invitedPHIDs": ["PHID-USER-2222"],
    "subscribers": ["PHID-USER-3333"]
  }
}

【附件使用示例】:
{
  "attachments": {
    "subscribers": true,
    "projects": true
  }
}

返回结果示例:
{
  "data": [
    {
      "id": 123,
      "phid": "PHID-EVNT-1111",
      "fields": {
        "name": "Team Meeting",
        "description": "Weekly team sync meeting",
        "isAllDay": false,
        "startDateTime": "2023-12-01T10:00:00",
        "endDateTime": "2023-12-01T11:00:00",
        "spacePHID": "PHID-SPCE-1111",
        "dateCreated": 1701388800,
        "dateModified": 1701388800,
        "policy": {
          "view": "public",
          "edit": "admin"
        }
      },
      "attachments": {
        "subscribers": {
          "subscriberPHIDs": ["PHID-USER-1111"],
          "subscriberCount": 1,
          "viewerIsSubscribed": true
        },
        "projects": {
          "projectPHIDs": ["PHID-PROJ-1111"],
          "projectCount": 1
        }
      }
    }
  ],
  "cursor": {
    "limit": 100,
    "after": "4567",
    "before": null,
    "order": null
  }
}

【注意事项】
- queryKey为空时从无约束开始查询
- constraints与queryKey结合时会覆盖默认值
- attachments会降低查询性能
- 最大限制为100个结果
- OAuth客户端无法调用此方法
- 返回map<string, wild>类型的数据
- 操作受权限和验证限制影响
- 只能查询用户有权限的事件
- 大量数据查询建议使用分页

【特色功能】
- 标准的ApplicationSearch方法实现
- 4种内置查询类型
- 14种约束条件
- 4种内置排序选项
- 5种低级排序列
- 9种对象字段
- 2种附加信息类型
- 完整的分页支持
- 灵活的查询组合

【安全限制】
- OAuth客户端无法调用此方法
- 返回map<string, wild>类型的数据
- 操作受权限和验证限制影响
- 只能查询用户有权限的事件`
      }
    },
  },
  'calendar.event.edit': {
    label: '日历事件编辑',
    params: {
      transactions: { type: 'json', default: '[]', placeholder: '事务列表，见下方详细说明' },
      objectIdentifier: { type: 'string', default: '', placeholder: '事件ID或PHID，留空创建新事件' },
      _help: { 
        type: 'static',
        content: `日历事件编辑使用指南:

【API功能】
标准的ApplicationEditor方法，用于通过应用事务来创建和修改日历事件对象。

【参数说明】
- transactions: 事务列表（必需参数）
- objectIdentifier: 事件ID或PHID（可选参数，留空创建新事件）

【参数详解】

1. transactions（必需）
   - 类型: list<map<string, wild>>
   - 说明: 要应用的事务列表
   - 示例: [{"type": "name", "value": "New Event"}]
   - 注意: 必须是有效的事务数组

2. objectIdentifier（可选）
   - 类型: id|phid|string
   - 说明: 要编辑的事件ID或PHID，留空创建新事件
   - 示例: "123", "PHID-EVNT-1111", "event-name"
   - 注意: 创建新事件时留空

【事务类型】
支持以下类型的事务：

1. space: 空间切换
   - 类型: const
   - 值: phid
   - 说明: 在空间之间移动对象

2. comment: 添加评论
   - 类型: const
   - 值: string
   - 说明: 要添加的评论，格式化为remarkup

3. name: 重命名事件
   - 类型: const
   - 值: string
   - 说明: 新事件名称

4. isAllDay: 全天事件
   - 类型: const
   - 值: bool
   - 说明: 将事件标记为全天事件

5. start: 更改开始时间
   - 类型: const
   - 值: epoch
   - 说明: 新事件开始时间

6. end: 更改结束时间
   - 类型: const
   - 值: epoch
   - 说明: 新事件结束时间

7. cancelled: 取消或恢复事件
   - 类型: const
   - 值: bool
   - 说明: true取消事件

8. hostPHID: 更改事件主机
   - 类型: const
   - 值: phid
   - 说明: 新事件主机

9. inviteePHIDs: 更改被邀请用户
   - 类型: const
   - 值: list<phid>
   - 说明: 新事件被邀请者

10. description: 更新事件描述
    - 类型: const
    - 值: string
    - 说明: 新事件描述

11. icon: 更改事件图标
    - 类型: const
    - 值: string
    - 说明: 新事件图标

12. isRecurring: 设置重复事件
    - 类型: const
    - 值: bool
    - 说明: 将事件标记为重复事件

13. frequency: 更改事件频率
    - 类型: const
    - 值: string
    - 说明: 新事件频率

14. until: 更改重复结束时间
    - 类型: const
    - 值: epoch
    - 说明: 新最终事件时间

15. view: 更改查看策略
    - 类型: const
    - 值: string
    - 说明: 新策略PHID或常量

16. edit: 更改编辑策略
    - 类型: const
    - 值: string
    - 说明: 新策略PHID或常量

17. projects.add: 添加项目标签
    - 类型: const
    - 值: list<project>
    - 说明: 要添加的PHID列表

18. projects.remove: 移除项目标签
    - 类型: const
    - 值: list<project>
    - 说明: 要移除的PHID列表

19. projects.set: 设置项目标签
    - 类型: const
    - 值: list<project>
    - 说明: 要设置的PHID列表

20. subscribers.add: 添加订阅者
    - 类型: const
    - 值: list<user>
    - 说明: 要添加的PHID列表

21. subscribers.remove: 移除订阅者
    - 类型: const
    - 值: list<user>
    - 说明: 要移除的PHID列表

22. subscribers.set: 设置订阅者
    - 类型: const
    - 值: list<user>
    - 说明: 要设置的PHID列表

【使用场景】
- 创建新的日历事件
- 修改现有事件的基本信息
- 设置事件的时间和重复规则
- 管理事件的参与者
- 添加评论和描述
- 设置事件权限和标签
- 取消或恢复事件

【操作示例】

创建新事件:
{
  "transactions": [
    {
      "type": "name",
      "value": "Team Meeting"
    },
    {
      "type": "description",
      "value": "Weekly team sync meeting"
    },
    {
      "type": "start",
      "value": 1701388800
    },
    {
      "type": "end",
      "value": 1701392400
    }
  ]
}

修改事件名称:
{
  "objectIdentifier": "PHID-EVNT-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Updated Event Name"
    }
  ]
}

设置全天事件:
{
  "objectIdentifier": "PHID-EVNT-1234",
  "transactions": [
    {
      "type": "isAllDay",
      "value": true
    }
  ]
}

更改事件时间:
{
  "objectIdentifier": "PHID-EVNT-1234",
  "transactions": [
    {
      "type": "start",
      "value": 1701475200
    },
    {
      "type": "end",
      "value": 1701478800
    }
  ]
}

取消事件:
{
  "objectIdentifier": "PHID-EVNT-1234",
  "transactions": [
    {
      "type": "cancelled",
      "value": true
    }
  ]
}

设置事件主机:
{
  "objectIdentifier": "PHID-EVNT-1234",
  "transactions": [
    {
      "type": "hostPHID",
      "value": "PHID-USER-1111"
    }
  ]
}

添加被邀请者:
{
  "objectIdentifier": "PHID-EVNT-1234",
  "transactions": [
    {
      "type": "inviteePHIDs",
      "value": ["PHID-USER-1111", "PHID-USER-2222"]
    }
  ]
}

设置重复事件:
{
  "objectIdentifier": "PHID-EVNT-1234",
  "transactions": [
    {
      "type": "isRecurring",
      "value": true
    },
    {
      "type": "frequency",
      "value": "weekly"
    },
    {
      "type": "until",
      "value": 1701993600
    }
  ]
}

添加项目标签:
{
  "objectIdentifier": "PHID-EVNT-1234",
  "transactions": [
    {
      "type": "projects.add",
      "value": ["PHID-PROJ-1111", "PHID-PROJ-2222"]
    }
  ]
}

添加订阅者:
{
  "objectIdentifier": "PHID-EVNT-1234",
  "transactions": [
    {
      "type": "subscribers.add",
      "value": ["PHID-USER-1111"]
    }
  ]
}

批量修改事件:
{
  "objectIdentifier": "PHID-EVNT-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Comprehensive Event Update"
    },
    {
      "type": "description",
      "value": "Updated event description with more details"
    },
    {
      "type": "start",
      "value": 1701475200
    },
    {
      "type": "end",
      "value": 1701478800
    },
    {
      "type": "hostPHID",
      "value": "PHID-USER-1111"
    },
    {
      "type": "inviteePHIDs",
      "value": ["PHID-USER-2222", "PHID-USER-3333"]
    }
  ]
}

【事务格式详解】

每个事务对象包含以下字段：
- type: 事务类型（必需）
- value: 事务值（必需，类型根据事务类型而定）

事务类型详细说明：

1. space事务:
{
  "type": "space",
  "value": "PHID-SPCE-1111"
}

- 说明: 在空间之间移动对象
- 值类型: phid
- 示例: "PHID-SPCE-1111"

2. comment事务:
{
  "type": "comment",
  "value": "This is a remarkup formatted comment."
}

- 说明: 添加评论
- 值类型: string
- 格式: remarkup格式

3. name事务:
{
  "type": "name",
  "value": "My Event Name"
}

- 说明: 设置事件名称
- 值类型: string
- 示例: "Team Meeting", "Project Review"

4. isAllDay事务:
{
  "type": "isAllDay",
  "value": true
}

- 说明: 设置全天事件
- 值类型: bool
- 示例: true, false

5. start事务:
{
  "type": "start",
  "value": 1701388800
}

- 说明: 设置事件开始时间
- 值类型: epoch
- 示例: 1701388800 (Unix时间戳)

6. end事务:
{
  "type": "end",
  "value": 1701392400
}

- 说明: 设置事件结束时间
- 值类型: epoch
- 示例: 1701392400 (Unix时间戳)

7. cancelled事务:
{
  "type": "cancelled",
  "value": true
}

- 说明: 取消或恢复事件
- 值类型: bool
- 示例: true（取消）, false（恢复）

8. hostPHID事务:
{
  "type": "hostPHID",
  "value": "PHID-USER-1111"
}

- 说明: 设置事件主机
- 值类型: phid
- 示例: "PHID-USER-1111"

9. inviteePHIDs事务:
{
  "type": "inviteePHIDs",
  "value": ["PHID-USER-1111", "PHID-USER-2222"]
}

- 说明: 设置被邀请用户
- 值类型: list<phid>
- 示例: 用户PHID列表

10. description事务:
{
  "type": "description",
  "value": "Event description text"
}

- 说明: 设置事件描述
- 值类型: string
- 格式: remarkup格式

11. icon事务:
{
  "type": "icon",
  "value": "calendar"
}

- 说明: 设置事件图标
- 值类型: string
- 示例: "calendar", "meeting", "reminder"

12. isRecurring事务:
{
  "type": "isRecurring",
  "value": true
}

- 说明: 设置重复事件
- 值类型: bool
- 示例: true, false

13. frequency事务:
{
  "type": "frequency",
  "value": "weekly"
}

- 说明: 设置事件频率
- 值类型: string
- 示例: "daily", "weekly", "monthly", "yearly"

14. until事务:
{
  "type": "until",
  "value": 1701993600
}

- 说明: 设置重复结束时间
- 值类型: epoch
- 示例: 1701993600 (Unix时间戳)

15. view事务:
{
  "type": "view",
  "value": "public"
}

- 说明: 更改查看权限
- 值类型: string
- 权限选项:
  - public: 公开访问
  - admin: 仅管理员
  - 用户PHID: 特定用户
  - 项目PHID: 特定项目成员

16. edit事务:
{
  "type": "edit",
  "value": "admin"
}

- 说明: 更改编辑权限
- 值类型: string
- 权限选项:
  - public: 公开编辑
  - admin: 仅管理员编辑
  - 用户PHID: 特定用户编辑
  - 项目PHID: 特定项目成员编辑

17. projects.add事务:
{
  "type": "projects.add",
  "value": ["PHID-PROJ-1111", "PHID-PROJ-2222"]
}

- 说明: 添加项目标签
- 值类型: list<project>
- 示例: 项目PHID列表

18. projects.remove事务:
{
  "type": "projects.remove",
  "value": ["PHID-PROJ-1111"]
}

- 说明: 移除项目标签
- 值类型: list<project>
- 示例: 要移除的项目PHID列表

19. projects.set事务:
{
  "type": "projects.set",
  "value": ["PHID-PROJ-3333"]
}

- 说明: 设置项目标签，覆盖当前值
- 值类型: list<project>
- 示例: 要设置的项目PHID列表

20. subscribers.add事务:
{
  "type": "subscribers.add",
  "value": ["PHID-USER-1111"]
}

- 说明: 添加订阅者
- 值类型: list<user>
- 示例: 用户PHID列表

21. subscribers.remove事务:
{
  "type": "subscribers.remove",
  "value": ["PHID-USER-1111"]
}

- 说明: 移除订阅者
- 值类型: list<user>
- 示例: 要移除的用户PHID列表

22. subscribers.set事务:
{
  "type": "subscribers.set",
  "value": ["PHID-USER-2222"]
}

- 说明: 设置订阅者，覆盖当前值
- 值类型: list<user>
- 示例: 要设置的用户PHID列表

【返回信息】
成功时返回包含以下信息的映射：
- id: 事件ID
- phid: 事件PHID
- name: 事件名称
- 其他更新后的字段信息

【使用流程】
1. 确定操作类型（创建或编辑）
2. 准备事务列表
3. 设置objectIdentifier（编辑时）或留空（创建时）
4. 执行编辑操作
5. 处理返回结果

【实际应用场景】

创建团队会议事件:
{
  "transactions": [
    {
      "type": "name",
      "value": "Weekly Team Meeting"
    },
    {
      "type": "description",
      "value": "Weekly sync meeting to discuss project progress"
    },
    {
      "type": "start",
      "value": 1701388800
    },
    {
      "type": "end",
      "value": 1701392400
    },
    {
      "type": "hostPHID",
      "value": "PHID-USER-1111"
    },
    {
      "type": "inviteePHIDs",
      "value": ["PHID-USER-2222", "PHID-USER-3333"]
    }
  ]
}

更新事件配置:
{
  "objectIdentifier": "PHID-EVNT-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Updated Event Name"
    },
    {
      "type": "description",
      "value": "Updated event description"
    },
    {
      "type": "comment",
      "value": "Event configuration has been updated."
    }
  ]
}

设置重复事件:
{
  "objectIdentifier": "PHID-EVNT-1234",
  "transactions": [
    {
      "type": "isRecurring",
      "value": true
    },
    {
      "type": "frequency",
      "value": "weekly"
    },
    {
      "type": "until",
      "value": 1701993600
    }
  ]
}

权限升级操作:
{
  "objectIdentifier": "PHID-EVNT-1234",
  "transactions": [
    {
      "type": "view",
      "value": "public"
    },
    {
      "type": "edit",
      "value": "PHID-PROJ-1111"
    }
  ]
}

批量操作示例:
const events = [
  {
    objectIdentifier: "PHID-EVNT-1111",
    transactions: [{"type": "name", "value": "Updated Event 1"}]
  },
  {
    objectIdentifier: "PHID-EVNT-2222", 
    transactions: [{"type": "description", "value": "New Description"}]
  }
];

for (const event of events) {
  try {
    const result = await calendar.event.edit(event);
    console.log('事件更新成功:', result);
  } catch (error) {
    console.error('事件更新失败:', error);
  }
}

【错误处理】
常见错误：
- 无效的事务类型: 使用支持的事务类型
- 缺少必需字段: 确保每个事务都有type和value
- 权限不足: 确认有编辑权限
- 事件不存在: 使用有效的objectIdentifier
- 事务格式错误: 检查JSON格式
- 时间冲突: 检查事件时间设置
- 权限值无效: 使用有效的权限PHID或常量
- PHID无效: 使用有效的用户或项目PHID

【最佳实践】
1. 使用有意义的事务顺序
2. 批量相关事务提高效率
3. 验证事务类型和值
4. 处理权限和验证错误
5. 记录重要的配置变更
6. 合理设置事件权限
7. 检查时间冲突
8. 设置合适的重复规则

【性能考虑】
- 批量事务比单个事务更高效
- 避免不必要的事务操作
- 合理设置权限策略
- 考虑事务的原子性
- 避免频繁修改重复事件

【安全考虑】
- 验证用户权限
- 检查事务类型合法性
- 验证权限值有效性
- 验证PHID有效性
- 记录重要操作日志
- 避免权限提升攻击
- 验证时间设置的合理性

【与日历系统的关系】
calendar.event.edit是日历系统的核心API：
- 用于创建和修改事件
- 支持事件权限管理
- 与其他日历API配合使用
- 提供事件配置管理
- 支持重复事件设置

【相关API】
calendar.event.search: 搜索事件
calendar.event.create: 创建事件
其他日历相关API

【事务原子性】
- 同一调用中的所有事务原子执行
- 任一事务失败会导致整个操作回滚
- 建议将相关事务放在同一调用中

【版本控制】
- 事件变更会被记录
- 支持配置历史追踪
- 可以回滚到之前的版本
- 重要变更建议备份

【权限管理最佳实践】
1. 私人事件: 设置为个人用户权限
2. 团队事件: 设置为项目权限
3. 公共事件: 谨慎设置公开权限
4. 管理事件: 限制为管理员权限
5. 定期审查权限设置

【事件命名规范】
1. 使用描述性名称
2. 避免特殊字符
3. 保持名称简洁明了
4. 考虑多语言支持
5. 避免名称冲突

【时间管理最佳实践】
1. 合理设置开始和结束时间
2. 避免时间冲突
3. 考虑时区差异
4. 设置合适的重复规则
5. 定期检查重复事件

【参与者管理】
1. 添加相关团队成员
2. 定期清理不活跃参与者
3. 设置合理的参与者数量限制
4. 记录参与者变更历史
5. 提供参与者权限说明

【重复事件管理】
1. 合理设置重复频率
2. 设置适当的结束时间
3. 避免无限重复
4. 定期检查重复事件
5. 考虑节假日影响

【注意事项】
- transactions必须是有效的JSON数组
- objectIdentifier为空时创建新事件
- 事务类型必须受支持
- value类型必须匹配事务类型
- OAuth客户端无法调用此方法
- 返回map<string, wild>类型的数据
- 操作受权限和验证限制影响
- 事务执行是原子的，要么全部成功要么全部失败
- 权限值必须是有效的PHID或常量
- 事件名称不能为空
- 开始时间必须早于结束时间
- PHID必须是有效的用户或项目PHID

【实际应用示例】

创建团队会议事件:
{
  "transactions": [
    {
      "type": "name",
      "value": "Development Team Meeting"
    },
    {
      "type": "description",
      "value": "Weekly development team sync meeting"
    },
    {
      "type": "start",
      "value": 1701388800
    },
    {
      "type": "end",
      "value": 1701392400
    },
    {
      "type": "hostPHID",
      "value": "PHID-USER-DEV1"
    },
    {
      "type": "inviteePHIDs",
      "value": ["PHID-USER-DEV2", "PHID-USER-DEV3", "PHID-USER-DEV4"]
    },
    {
      "type": "projects.add",
      "value": ["PHID-PROJ-DEV"]
    }
  ]
}

创建重复事件:
{
  "transactions": [
    {
      "type": "name",
      "value": "Daily Standup"
    },
    {
      "type": "description",
      "value": "Daily team standup meeting"
    },
    {
      "type": "start",
      "value": 1701388800
    },
    {
      "type": "end",
      "value": 1701390600
    },
    {
      "type": "isRecurring",
      "value": true
    },
    {
      "type": "frequency",
      "value": "daily"
    },
    {
      "type": "until",
      "value": 1701993600
    }
  ]
}

更新事件信息:
{
  "objectIdentifier": "PHID-EVNT-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Updated Event Name"
    },
    {
      "type": "description",
      "value": "Updated event description with more details"
    },
    {
      "type": "start",
      "value": 1701475200
    },
    {
      "type": "end",
      "value": 1701478800
    },
    {
      "type": "comment",
      "value": "Event has been updated with new configuration."
    }
  ]
}

权限升级操作:
{
  "objectIdentifier": "PHID-EVNT-1234",
  "transactions": [
    {
      "type": "view",
      "value": "public"
    },
    {
      "type": "edit",
      "value": "PHID-PROJ-1111"
    }
  ]
}

参与者管理操作:
{
  "objectIdentifier": "PHID-EVNT-1234",
  "transactions": [
    {
      "type": "inviteePHIDs",
      "value": ["PHID-USER-NEW1", "PHID-USER-NEW2"]
    },
    {
      "type": "hostPHID",
      "value": "PHID-USER-NEW3"
    },
    {
      "type": "comment",
      "value": "Updated event participants."
    }
  ]
}

取消事件:
{
  "objectIdentifier": "PHID-EVNT-1234",
  "transactions": [
    {
      "type": "cancelled",
      "value": true
    },
    {
      "type": "comment",
      "value": "Event has been cancelled."
    }
  ]
}

恢复事件:
{
  "objectIdentifier": "PHID-EVNT-1234",
  "transactions": [
    {
      "type": "cancelled",
      "value": false
    },
    {
      "type": "comment",
      "value": "Event has been restored."
    }
  ]
}

【特色功能】
- 完整的ApplicationEditor标准实现
- 22种事务类型支持
- 灵活的权限管理
- 参与者管理
- 重复事件支持
- 评论功能
- 原子性事务执行
- 详细的操作日志
- 时间管理功能

【安全限制】
- OAuth客户端无法调用此方法
- 返回map<string, wild>类型的数据
- 操作受权限和验证限制影响
- 事务执行是原子的，要么全部成功要么全部失败
- 权限值必须是有效的PHID或常量
- 事件名称不能为空
- 开始时间必须早于结束时间
- PHID必须是有效的用户或项目PHID`
      }
    },
  },
  'badge.search': {
    label: '徽章搜索',
    params: {
      queryKey: { type: 'string', default: '', placeholder: '查询类型：open/all' },
      constraints: { type: 'json', default: '{}', placeholder: '约束条件，见下方常用示例' },
      attachments: { type: 'json', default: '{}', placeholder: '附加信息，如：{"subscribers":true}' },
      order: { type: 'string', default: 'quality', placeholder: '排序：quality/shoddiness/newest/oldest' },
      before: { type: 'string', default: '', placeholder: '分页游标，获取前一页' },
      after: { type: 'string', default: '', placeholder: '分页游标，获取后一页' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制，默认100' },
      _help: { 
        type: 'static',
        content: `徽章搜索使用指南:

【API功能】
标准的ApplicationSearch方法，用于列出、查询或搜索徽章对象。支持内置查询、自定义约束、排序、附件和分页功能。

【参数说明】
- queryKey: 查询类型（可选参数）
- constraints: 约束条件（可选参数）
- attachments: 附加信息（可选参数）
- order: 排序方式（可选参数）
- before: 分页游标，获取前一页（可选参数）
- after: 分页游标，获取后一页（可选参数）
- limit: 结果数量限制（可选参数，默认100）

【参数详解】

1. queryKey（可选）
   - 类型: string
   - 说明: 内置或保存的查询键
   - 默认值: 空
   - 示例: "open", "all"
   - 注意: 如果不指定，查询将从无约束开始

2. constraints（可选）
   - 类型: map<string, wild>
   - 说明: 自定义约束条件字典
   - 默认值: {}
   - 示例: {"authors": ["PHID-USER-1111"], "statuses": ["open"]}
   - 注意: 与queryKey结合使用时，会覆盖默认约束

3. attachments（可选）
   - 类型: map<string, bool>
   - 说明: 请求额外信息
   - 默认值: {}
   - 示例: {"subscribers": true}
   - 注意: 请求更多信息会降低查询性能

4. order（可选）
   - 类型: order
   - 说明: 结果排序方式
   - 默认值: quality
   - 示例: "quality", "shoddiness", "newest", "oldest"
   - 注意: 可以使用内置键或自定义列排序

5. before（可选）
   - 类型: string
   - 说明: 分页游标，获取前一页
   - 默认值: 空
   - 示例: "1234"
   - 注意: 与after配合使用进行分页

6. after（可选）
   - 类型: string
   - 说明: 分页游标，获取后一页
   - 默认值: 空
   - 示例: "4567"
   - 注意: 与before配合使用进行分页

7. limit（可选）
   - 类型: int
   - 说明: 结果数量限制
   - 默认值: 100
   - 示例: 50
   - 注意: 最大100，需要更多结果时使用分页

【内置查询类型】
支持以下内置查询键：

1. open: 活跃徽章
   - 说明: 显示活跃状态的徽章
   - 适用场景: 查看当前可用的徽章

2. all: 全部徽章
   - 说明: 显示所有徽章
   - 适用场景: 完整徽章列表

【约束类型】
支持以下约束键：

1. ids: ID列表
   - 类型: list<int>
   - 说明: 搜索特定ID的对象
   - 示例: [123, 456, 789]

2. phids: PHID列表
   - 类型: list<phid>
   - 说明: 搜索特定PHID的对象
   - 示例: ["PHID-BDG-1111", "PHID-BDG-2222"]

3. name: 名称包含
   - 类型: string
   - 说明: 按名称子字符串搜索徽章
   - 示例: "team", "project"

4. qualities: 质量
   - 类型: 
   - 说明: 徽章质量
   - 注意: 不支持

5. statuses: 状态
   - 类型: list<string>
   - 说明: 徽章状态列表
   - 示例: ["active", "archived"]

6. subscribers: 订阅者
   - 类型: list<user>
   - 说明: 具有特定订阅者的对象
   - 示例: ["PHID-USER-1111"]

【排序选项】
支持以下内置排序：

1. quality: 稀有度（最稀有优先）
   - 说明: 按徽章稀有度排序，最稀有的在前
   - 列: quality, id

2. shoddiness: 稀有度（最常见优先）
   - 说明: 按徽章稀有度排序，最常见的在前
   - 列: -quality, -id

3. newest: 创建日期（最新的优先）
   - 说明: 按创建时间降序排列
   - 列: id

4. oldest: 创建日期（最旧的优先）
   - 说明: 按创建时间升序排列
   - 列: -id

【低级排序列】
支持以下低级排序列：

1. quality: 质量
   - 唯一: 否

2. id: ID
   - 唯一: 是

【对象字段】
返回的对象包含以下字段：

1. name: 徽章名称
   - 类型: string
   - 说明: 徽章的名称

2. creatorPHID: 创建者PHID
   - 类型: phid
   - 说明: 创建者的用户PHID

3. status: 状态
   - 类型: string
   - 说明: 徽章的活跃或归档状态

4. dateCreated: 创建日期
   - 类型: int
   - 说明: 对象创建时的纪元时间戳

5. dateModified: 修改日期
   - 类型: int
   - 说明: 对象最后更新时的纪元时间戳

6. policy: 策略
   - 类型: map<string, wild>
   - 说明: 从功能到当前策略的映射

【附加信息】
支持以下附加信息：

1. subscribers: 订阅者
   - 说明: 获取订阅者信息
   - 返回: subscriberPHIDs, subscriberCount, viewerIsSubscribed

【分页和限制】
- 查询限制为每次返回100个结果
- 使用limit指定较小的限制
- 使用before和after游标进行分页
- cursor包含分页信息

【使用场景】
- 查询特定名称的徽章
- 搜索特定用户创建的徽章
- 获取活跃状态的徽章
- 按稀有度排序徽章
- 分页浏览大量徽章
- 获取徽章详细信息

【操作示例】

使用内置查询:
{
  "queryKey": "open"
}

自定义约束:
{
  "constraints": {
    "name": "team",
    "statuses": ["active"]
  }
}

请求附加信息:
{
  "attachments": {
    "subscribers": true
  }
}

排序结果:
{
  "order": "quality"
}

分页查询:
{
  "limit": 50,
  "after": "1234"
}

完整查询示例:
{
  "queryKey": "open",
  "constraints": {
    "name": "project"
  },
  "attachments": {
    "subscribers": true
  },
  "order": "quality",
  "limit": 50
}

【返回信息】
成功时返回map<string, wild>，包含：
- data: 徽章列表
- cursor: 分页信息
- 其他元数据

【错误处理】
常见错误：
- ERR-CONDUIT-CORE: 核心错误，详见错误消息
- 权限不足: 无法访问指定徽章
- 参数无效: 约束条件格式错误
- 分页错误: 游标无效

【最佳实践】
1. 使用合适的queryKey提高查询效率
2. 合理设置limit避免过多数据
3. 只请求需要的attachments
4. 使用分页处理大量结果
5. 结合约束条件精确筛选

【性能考虑】
- 限制结果数量提高响应速度
- 谨慎使用attachments
- 合理使用约束条件
- 考虑缓存频繁查询

【安全考虑】
- OAuth客户端无法调用此方法
- 只能查询用户有权限的徽章
- 返回数据受权限策略限制
- 记录重要查询操作

【与徽章系统的关系】
badge.search是徽章系统的核心API：
- 用于查询和管理徽章
- 支持多种查询和筛选方式
- 与其他徽章API配合使用
- 提供完整的徽章信息

【相关API】
badge.edit: 编辑徽章
badge.create: 创建徽章
其他徽章相关API

【分页示例】
// 第一页
{
  "limit": 50,
  "after": ""
}

// 第二页
{
  "limit": 50,
  "after": "1234"
}

// 第三页
{
  "limit": 50,
  "after": "5678"
}

【实际应用场景】
查询活跃徽章:
{
  "queryKey": "open",
  "attachments": {
    "subscribers": true
  }
}

按名称搜索徽章:
{
  "constraints": {
    "name": "team"
  },
  "order": "quality"
}

查询用户创建的徽章:
{
  "constraints": {
    "creatorPHIDs": ["PHID-USER-1111"]
  },
  "order": "newest"
}

搜索徽章:
{
  "constraints": {
    "name": "project"
  },
  "order": "relevance"
}

【批量操作示例】:
const queries = [
  {
    queryKey: "open",
    limit: 50
  },
  {
    constraints: { name: "team" },
    limit: 50
  },
  {
    constraints: { statuses: ["active"] },
    limit: 50
  }
];

for (const query of queries) {
  try {
    const result = await badge.search(query);
    console.log('徽章查询成功:', result);
  } catch (error) {
    console.error('徽章查询失败:', error);
  }
}

【自定义排序示例】:
// 按稀有度排序（最稀有优先）
{
  "order": "quality"
}

// 按稀有度排序（最常见优先）
{
  "order": "shoddiness"
}

// 按创建时间排序（最新的优先）
{
  "order": "newest"
}

// 自定义列排序
{
  "order": ["quality", "-id"]
}

【约束组合示例】:
{
  "constraints": {
    "name": "project",
    "statuses": ["active"],
    "subscribers": ["PHID-USER-1111"]
  }
}

【附件使用示例】:
{
  "attachments": {
    "subscribers": true
  }
}

返回结果示例:
{
  "data": [
    {
      "id": 123,
      "phid": "PHID-BDG-1111",
      "fields": {
        "name": "Team Player",
        "creatorPHID": "PHID-USER-1111",
        "status": "active",
        "dateCreated": 1701388800,
        "dateModified": 1701388800,
        "policy": {
          "view": "public",
          "edit": "admin"
        }
      },
      "attachments": {
        "subscribers": {
          "subscriberPHIDs": ["PHID-USER-1111"],
          "subscriberCount": 1,
          "viewerIsSubscribed": true
        }
      }
    }
  ],
  "cursor": {
    "limit": 100,
    "after": "4567",
    "before": null,
    "order": null
  }
}

【注意事项】
- queryKey为空时从无约束开始查询
- constraints与queryKey结合时会覆盖默认值
- attachments会降低查询性能
- 最大限制为100个结果
- OAuth客户端无法调用此方法
- 返回map<string, wild>类型的数据
- 操作受权限和验证限制影响
- 只能查询用户有权限的徽章
- 大量数据查询建议使用分页

【特色功能】
- 标准的ApplicationSearch方法实现
- 2种内置查询类型
- 6种约束条件
- 4种内置排序选项
- 2种低级排序列
- 6种对象字段
- 1种附加信息类型
- 完整的分页支持
- 灵活的查询组合

【安全限制】
- OAuth客户端无法调用此方法
- 返回map<string, wild>类型的数据
- 操作受权限和验证限制影响
- 只能查询用户有权限的徽章`
      }
    },
  },
  'badge.edit': {
    label: '徽章编辑',
    params: {
      transactions: { type: 'json', default: '[]', placeholder: '事务列表，见下方详细说明' },
      objectIdentifier: { type: 'string', default: '', placeholder: '徽章ID或PHID，留空创建新徽章' },
      _help: { 
        type: 'static',
        content: `徽章编辑使用指南:

【API功能】
标准的ApplicationEditor方法，用于通过应用事务来创建和修改徽章对象。

【参数说明】
- transactions: 事务列表（必需参数）
- objectIdentifier: 徽章ID或PHID（可选参数，留空创建新徽章）

【参数详解】

1. transactions（必需）
   - 类型: list<map<string, wild>>
   - 说明: 要应用的事务列表
   - 示例: [{"type": "name", "value": "New Badge"}]
   - 注意: 必须是有效的事务数组

2. objectIdentifier（可选）
   - 类型: id|phid|string
   - 说明: 要编辑的徽章ID或PHID，留空创建新徽章
   - 示例: "123", "PHID-BDG-1111", "badge-name"
   - 注意: 创建新徽章时留空

【事务类型】
支持以下类型的事务：

1. comment: 添加评论
   - 类型: const
   - 值: string
   - 说明: 要添加的评论，格式化为remarkup

2. name: 徽章名称
   - 类型: const
   - 值: string
   - 说明: 新徽章名称

3. flavor: 徽章简短描述
   - 类型: const
   - 值: string
   - 说明: 新徽章简短描述

4. icon: 更改徽章图标
   - 类型: const
   - 值: string
   - 说明: 新徽章图标

5. quality: 徽章颜色和稀有度
   - 类型: const
   - 值: string
   - 说明: 新徽章质量

6. description: 徽章长描述
   - 类型: const
   - 值: string
   - 说明: 新徽章描述

7. award: 新徽章授予接收者
   - 类型: const
   - 值: list<phid>
   - 说明: 新徽章授予接收者

8. revoke: 撤销徽章授予接收者
   - 类型: const
   - 值: list<phid>
   - 说明: 撤销徽章授予接收者

9. edit: 更改编辑策略
   - 类型: const
   - 值: string
   - 说明: 新策略PHID或常量

10. subscribers.add: 添加订阅者
    - 类型: const
    - 值: list<user>
    - 说明: 要添加的PHID列表

11. subscribers.remove: 移除订阅者
    - 类型: const
    - 值: list<user>
    - 说明: 要移除的PHID列表

12. subscribers.set: 设置订阅者
    - 类型: const
    - 值: list<user>
    - 说明: 要设置的PHID列表

【使用场景】
- 创建新的徽章
- 修改现有徽章的基本信息
- 设置徽章的图标和质量
- 管理徽章的授予和撤销
- 添加评论和描述
- 设置徽章权限和订阅者
- 批量管理徽章

【操作示例】

创建新徽章:
{
  "transactions": [
    {
      "type": "name",
      "value": "Team Player"
    },
    {
      "type": "flavor",
      "value": "Great team collaboration"
    },
    {
      "type": "description",
      "value": "Awarded for excellent team collaboration"
    },
    {
      "type": "icon",
      "value": "medal"
    },
    {
      "type": "quality",
      "value": "gold"
    }
  ]
}

修改徽章名称:
{
  "objectIdentifier": "PHID-BDG-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Updated Badge Name"
    }
  ]
}

设置徽章图标:
{
  "objectIdentifier": "PHID-BDG-1234",
  "transactions": [
    {
      "type": "icon",
      "value": "star"
    }
  ]
}

设置徽章质量:
{
  "objectIdentifier": "PHID-BDG-1234",
  "transactions": [
    {
      "type": "quality",
      "value": "platinum"
    }
  ]
}

授予徽章:
{
  "objectIdentifier": "PHID-BDG-1234",
  "transactions": [
    {
      "type": "award",
      "value": ["PHID-USER-1111", "PHID-USER-2222"]
    }
  ]
}

撤销徽章:
{
  "objectIdentifier": "PHID-BDG-1234",
  "transactions": [
    {
      "type": "revoke",
      "value": ["PHID-USER-3333"]
    }
  ]
}

添加评论:
{
  "objectIdentifier": "PHID-BDG-1234",
  "transactions": [
    {
      "type": "comment",
      "value": "This badge has been updated with new settings."
    }
  ]
}

设置编辑权限:
{
  "objectIdentifier": "PHID-BDG-1234",
  "transactions": [
    {
      "type": "edit",
      "value": "admin"
    }
  ]
}

添加订阅者:
{
  "objectIdentifier": "PHID-BDG-1234",
  "transactions": [
    {
      "type": "subscribers.add",
      "value": ["PHID-USER-1111"]
    }
  ]
}

批量修改徽章:
{
  "objectIdentifier": "PHID-BDG-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Comprehensive Badge Update"
    },
    {
      "type": "flavor",
      "value": "Updated badge flavor"
    },
    {
      "type": "description",
      "value": "Updated badge description with more details"
    },
    {
      "type": "icon",
      "value": "trophy"
    },
    {
      "type": "quality",
      "value": "diamond"
    },
    {
      "type": "award",
      "value": ["PHID-USER-1111", "PHID-USER-2222"]
    }
  ]
}

【事务格式详解】

每个事务对象包含以下字段：
- type: 事务类型（必需）
- value: 事务值（必需，类型根据事务类型而定）

事务类型详细说明：

1. comment事务:
{
  "type": "comment",
  "value": "This is a remarkup formatted comment."
}

- 说明: 添加评论
- 值类型: string
- 格式: remarkup格式

2. name事务:
{
  "type": "name",
  "value": "My Badge Name"
}

- 说明: 设置徽章名称
- 值类型: string
- 示例: "Team Player", "Project Hero"

3. flavor事务:
{
  "type": "flavor",
  "value": "Short badge description"
}

- 说明: 设置徽章简短描述
- 值类型: string
- 示例: "Great team collaboration", "Outstanding performance"

4. icon事务:
{
  "type": "icon",
  "value": "medal"
}

- 说明: 设置徽章图标
- 值类型: string
- 示例: "medal", "star", "trophy", "ribbon"

5. quality事务:
{
  "type": "quality",
  "value": "gold"
}

- 说明: 设置徽章质量和稀有度
- 值类型: string
- 示例: "bronze", "silver", "gold", "platinum", "diamond"

6. description事务:
{
  "type": "description",
  "value": "Detailed badge description"
}

- 说明: 设置徽章长描述
- 值类型: string
- 格式: remarkup格式

7. award事务:
{
  "type": "award",
  "value": ["PHID-USER-1111", "PHID-USER-2222"]
}

- 说明: 授予徽章给用户
- 值类型: list<phid>
- 示例: 用户PHID列表

8. revoke事务:
{
  "type": "revoke",
  "value": ["PHID-USER-3333"]
}

- 说明: 撤销用户的徽章
- 值类型: list<phid>
- 示例: 要撤销的用户PHID列表

9. edit事务:
{
  "type": "edit",
  "value": "admin"
}

- 说明: 更改编辑权限
- 值类型: string
- 权限选项:
  - public: 公开编辑
  - admin: 仅管理员编辑
  - 用户PHID: 特定用户编辑
  - 项目PHID: 特定项目成员编辑

10. subscribers.add事务:
{
  "type": "subscribers.add",
  "value": ["PHID-USER-1111"]
}

- 说明: 添加订阅者
- 值类型: list<user>
- 示例: 用户PHID列表

11. subscribers.remove事务:
{
  "type": "subscribers.remove",
  "value": ["PHID-USER-1111"]
}

- 说明: 移除订阅者
- 值类型: list<user>
- 示例: 要移除的用户PHID列表

12. subscribers.set事务:
{
  "type": "subscribers.set",
  "value": ["PHID-USER-2222"]
}

- 说明: 设置订阅者，覆盖当前值
- 值类型: list<user>
- 示例: 要设置的用户PHID列表

【返回信息】
成功时返回包含以下信息的映射：
- id: 徽章ID
- phid: 徽章PHID
- name: 徽章名称
- 其他更新后的字段信息

【使用流程】
1. 确定操作类型（创建或编辑）
2. 准备事务列表
3. 设置objectIdentifier（编辑时）或留空（创建时）
4. 执行编辑操作
5. 处理返回结果

【实际应用场景】

创建团队徽章:
{
  "transactions": [
    {
      "type": "name",
      "value": "Team Excellence"
    },
    {
      "type": "flavor",
      "value": "Outstanding team collaboration"
    },
    {
      "type": "description",
      "value": "Awarded to team members who demonstrate exceptional collaboration and teamwork."
    },
    {
      "type": "icon",
      "value": "trophy"
    },
    {
      "type": "quality",
      "value": "gold"
    }
  ]
}

更新徽章配置:
{
  "objectIdentifier": "PHID-BDG-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Updated Badge Name"
    },
    {
      "type": "description",
      "value": "Updated badge description"
    },
    {
      "type": "comment",
      "value": "Badge configuration has been updated."
    }
  ]
}

授予徽章给团队:
{
  "objectIdentifier": "PHID-BDG-1234",
  "transactions": [
    {
      "type": "award",
      "value": ["PHID-USER-1111", "PHID-USER-2222", "PHID-USER-3333"]
    },
    {
      "type": "comment",
      "value": "Badge awarded to team members for excellent performance."
    }
  ]
}

权限升级操作:
{
  "objectIdentifier": "PHID-BDG-1234",
  "transactions": [
    {
      "type": "edit",
      "value": "admin"
    }
  ]
}

批量操作示例:
const badges = [
  {
    objectIdentifier: "PHID-BDG-1111",
    transactions: [{"type": "name", "value": "Updated Badge 1"}]
  },
  {
    objectIdentifier: "PHID-BDG-2222", 
    transactions: [{"type": "description", "value": "New Description"}]
  }
];

for (const badge of badges) {
  try {
    const result = await badge.edit(badge);
    console.log('徽章更新成功:', result);
  } catch (error) {
    console.error('徽章更新失败:', error);
  }
}

【徽章质量等级】
徽章质量通常按稀有度排序：
1. **bronze**: 铜牌 - 最常见
2. **silver**: 银牌 - 常见
3. **gold**: 金牌 - 稀有
4. **platinum**: 白金 - 很稀有
5. **diamond**: 钻石 - 最稀有

【错误处理】
常见错误：
- 无效的事务类型: 使用支持的事务类型
- 缺少必需字段: 确保每个事务都有type和value
- 权限不足: 确认有编辑权限
- 徽章不存在: 使用有效的objectIdentifier
- 事务格式错误: 检查JSON格式
- 权限值无效: 使用有效的权限PHID或常量
- PHID无效: 使用有效的用户PHID
- 质量值无效: 使用有效的质量等级

【最佳实践】
1. 使用有意义的事务顺序
2. 批量相关事务提高效率
3. 验证事务类型和值
4. 处理权限和验证错误
5. 记录重要的配置变更
6. 合理设置徽章权限
7. 选择合适的质量等级
8. 管理徽章授予记录

【性能考虑】
- 批量事务比单个事务更高效
- 避免不必要的事务操作
- 合理设置权限策略
- 考虑事务的原子性
- 避免频繁修改徽章配置

【安全考虑】
- 验证用户权限
- 检查事务类型合法性
- 验证权限值有效性
- 验证PHID有效性
- 记录重要操作日志
- 避免权限提升攻击
- 验证质量设置的合理性

【与徽章系统的关系】
badge.edit是徽章系统的核心API：
- 用于创建和修改徽章
- 支持徽章权限管理
- 与其他徽章API配合使用
- 提供徽章配置管理
- 支持徽章授予和撤销

【相关API】
badge.search: 搜索徽章
badge.create: 创建徽章
其他徽章相关API

【事务原子性】
- 同一调用中的所有事务原子执行
- 任一事务失败会导致整个操作回滚
- 建议将相关事务放在同一调用中

【版本控制】
- 徽章变更会被记录
- 支持配置历史追踪
- 可以回滚到之前的版本
- 重要变更建议备份

【权限管理最佳实践】
1. 私人徽章: 设置为个人用户权限
2. 团队徽章: 设置为项目权限
3. 公共徽章: 谨慎设置公开权限
4. 管理徽章: 限制为管理员权限
5. 定期审查权限设置

【徽章命名规范】
1. 使用描述性名称
2. 避免特殊字符
3. 保持名称简洁明了
4. 考虑多语言支持
5. 避免名称冲突

【徽章描述规范】
1. 提供清晰的徽章说明
2. 说明授予标准和条件
3. 使用remarkup格式
4. 保持描述简洁但完整
5. 定期更新描述内容

【授予管理最佳实践】
1. 明确授予标准
2. 记录授予原因
3. 定期审查授予记录
4. 避免重复授予
5. 提供撤销机制

【质量等级管理】
1. 根据稀有度设置质量等级
2. 保持质量等级的一致性
3. 定期评估质量分配
4. 考虑徽章的重要性
5. 平衡质量等级分布

【注意事项】
- transactions必须是有效的JSON数组
- objectIdentifier为空时创建新徽章
- 事务类型必须受支持
- value类型必须匹配事务类型
- OAuth客户端无法调用此方法
- 返回map<string, wild>类型的数据
- 操作受权限和验证限制影响
- 事务执行是原子的，要么全部成功要么全部失败
- 权限值必须是有效的PHID或常量
- 徽章名称不能为空
- 质量值必须是预定义的等级
- PHID必须是有效的用户PHID

【实际应用示例】

创建项目徽章:
{
  "transactions": [
    {
      "type": "name",
      "value": "Project Champion"
    },
    {
      "type": "flavor",
      "value": "Outstanding project contribution"
    },
    {
      "type": "description",
      "value": "Awarded to team members who make exceptional contributions to project success."
    },
    {
      "type": "icon",
      "value": "star"
    },
    {
      "type": "quality",
      "value": "platinum"
    }
  ]
}

创建团队协作徽章:
{
  "transactions": [
    {
      "type": "name",
      "value": "Collaboration Master"
    },
    {
      "type": "flavor",
      "value": "Excellent team collaboration"
    },
    {
      "type": "description",
      "value": "Recognizes individuals who demonstrate outstanding collaboration skills and teamwork."
    },
    {
      "type": "icon",
      "value": "medal"
    },
    {
      "type": "quality",
      "value": "gold"
    }
  ]
}

更新徽章信息:
{
  "objectIdentifier": "PHID-BDG-1234",
  "transactions": [
    {
      "type": "name",
      "value": "Updated Badge Name"
    },
    {
      "type": "description",
      "value": "Updated badge description with more comprehensive details."
    },
    {
      "type": "flavor",
      "value": "Updated badge flavor text"
    },
    {
      "type": "comment",
      "value": "Badge has been updated with new configuration."
    }
  ]
}

权限升级操作:
{
  "objectIdentifier": "PHID-BDG-1234",
  "transactions": [
    {
      "type": "edit",
      "value": "admin"
    }
  ]
}

授予徽章操作:
{
  "objectIdentifier": "PHID-BDG-1234",
  "transactions": [
    {
      "type": "award",
      "value": ["PHID-USER-NEW1", "PHID-USER-NEW2"]
    },
    {
      "type": "comment",
      "value": "Badge awarded to new recipients for outstanding performance."
    }
  ]
}

撤销徽章操作:
{
  "objectIdentifier": "PHID-BDG-1234",
  "transactions": [
    {
      "type": "revoke",
      "value": ["PHID-USER-OLD1"]
    },
    {
      "type": "comment",
      "value": "Badge revoked due to policy change."
    }
  ]
}

订阅者管理操作:
{
  "objectIdentifier": "PHID-BDG-1234",
  "transactions": [
    {
      "type": "subscribers.add",
      "value": ["PHID-USER-NEW1"]
    },
    {
      "type": "comment",
      "value": "Added new subscribers to badge updates."
    }
  ]
}

【特色功能】
- 完整的ApplicationEditor标准实现
- 12种事务类型支持
- 灵活的权限管理
- 徽章授予和撤销功能
- 评论功能
- 原子性事务执行
- 详细的操作日志
- 质量等级管理

【安全限制】
- OAuth客户端无法调用此方法
- 返回map<string, wild>类型的数据
- 操作受权限和验证限制影响
- 事务执行是原子的，要么全部成功要么全部失败
- 权限值必须是有效的PHID或常量
- 徽章名称不能为空
- 质量值必须是预定义的等级
- PHID必须是有效的用户PHID`
      }
    },
  },
  'audit.query': {
    label: '审计查询',
    params: {
      auditorPHIDs: { type: 'json', default: '[]', placeholder: '审计员PHID列表，可选参数' },
      commitPHIDs: { type: 'json', default: '[]', placeholder: '提交PHID列表，可选参数' },
      status: { type: 'string', default: 'audit-status-any', placeholder: '状态：audit-status-any/audit-status-open/audit-status-concern/audit-status-accepted/audit-status-partial' },
      offset: { type: 'number', default: '', placeholder: '偏移量，可选参数' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制，默认100' },
      _help: { 
        type: 'static',
        content: `审计查询使用指南:

【API功能】
查询审计请求。这是一个冻结方法，最终将被弃用。新代码应使用"diffusion.commit.search"代替。

【参数说明】
- auditorPHIDs: 审计员PHID列表（可选参数）
- commitPHIDs: 提交PHID列表（可选参数）
- status: 状态（可选参数，默认audit-status-any）
- offset: 偏移量（可选参数）
- limit: 结果数量限制（可选参数，默认100）

【参数详解】

1. auditorPHIDs（可选）
   - 类型: list<phid>
   - 说明: 审计员PHID列表
   - 默认值: []
   - 示例: ["PHID-USER-1111", "PHID-USER-2222"]
   - 注意: 用于筛选特定审计员的审计请求

2. commitPHIDs（可选）
   - 类型: list<phid>
   - 说明: 提交PHID列表
   - 默认值: []
   - 示例: ["PHID-CMIT-1111", "PHID-CMIT-2222"]
   - 注意: 用于筛选特定提交的审计请求

3. status（可选）
   - 类型: string-constant
   - 说明: 审计状态
   - 默认值: audit-status-any
   - 可选值:
     - audit-status-any: 任何状态
     - audit-status-open: 开放状态
     - audit-status-concern: 关注状态
     - audit-status-accepted: 已接受状态
     - audit-status-partial: 部分状态
   - 注意: 用于筛选特定状态的审计请求

4. offset（可选）
   - 类型: int
   - 说明: 偏移量
   - 默认值: 空
   - 示例: 0, 100, 200
   - 注意: 用于分页查询，跳过指定数量的结果

5. limit（可选）
   - 类型: int
   - 说明: 结果数量限制
   - 默认值: 100
   - 示例: 50, 100, 200
   - 注意: 限制返回的结果数量

【使用场景】
- 查询特定审计员的审计请求
- 查询特定提交的审计请求
- 按状态筛选审计请求
- 分页浏览审计请求
- 获取审计请求列表

【操作示例】

查询所有审计请求:
{
}

按审计员筛选:
{
  "auditorPHIDs": ["PHID-USER-1111"]
}

按提交筛选:
{
  "commitPHIDs": ["PHID-CMIT-1111"]
}

按状态筛选:
{
  "status": "audit-status-open"
}

组合查询:
{
  "auditorPHIDs": ["PHID-USER-1111"],
  "commitPHIDs": ["PHID-CMIT-1111"],
  "status": "audit-status-open"
}

分页查询:
{
  "offset": 0,
  "limit": 50
}

完整查询示例:
{
  "auditorPHIDs": ["PHID-USER-1111", "PHID-USER-2222"],
  "commitPHIDs": ["PHID-CMIT-1111"],
  "status": "audit-status-concern",
  "offset": 0,
  "limit": 100
}

【状态说明】
审计请求的状态包括：

1. **audit-status-any**: 任何状态
   - 说明: 包含所有状态的审计请求
   - 适用场景: 获取所有审计请求

2. **audit-status-open**: 开放状态
   - 说明: 正在进行的审计请求
   - 适用场景: 查看待处理的审计请求

3. **audit-status-concern**: 关注状态
   - 说明: 存在问题的审计请求
   - 适用场景: 查看需要关注的审计请求

4. **audit-status-accepted**: 已接受状态
   - 说明: 已被接受的审计请求
   - 适用场景: 查看已通过的审计请求

5. **audit-status-partial**: 部分状态
   - 说明: 部分完成的审计请求
   - 适用场景: 查看部分处理的审计请求

【返回信息】
成功时返回list<dict>，包含审计请求列表：
- 每个审计请求包含详细信息
- 包含审计员、提交、状态等信息
- 按查询条件筛选的结果

【使用流程】
1. 确定查询条件（审计员、提交、状态）
2. 设置分页参数（可选）
3. 执行查询操作
4. 处理返回结果

【实际应用场景】

查询特定审计员的请求:
{
  "auditorPHIDs": ["PHID-USER-1111"],
  "limit": 50
}

查询特定提交的审计:
{
  "commitPHIDs": ["PHID-CMIT-1111"],
  "status": "audit-status-open"
}

查询待处理的审计请求:
{
  "status": "audit-status-open",
  "limit": 100
}

查询有问题的审计请求:
{
  "status": "audit-status-concern",
  "auditorPHIDs": ["PHID-USER-1111"]
}

分页查询审计请求:
{
  "offset": 100,
  "limit": 50
}

【批量操作示例】:
const queries = [
  {
    auditorPHIDs: ["PHID-USER-1111"],
    status: "audit-status-open"
  },
  {
    commitPHIDs: ["PHID-CMIT-1111"],
    status: "audit-status-concern"
  },
  {
    status: "audit-status-accepted",
    limit: 50
  }
];

for (const query of queries) {
  try {
    const result = await audit.query(query);
    console.log('审计查询成功:', result);
  } catch (error) {
    console.error('审计查询失败:', error);
  }
}

【状态查询示例】:
// 查询所有开放状态的审计请求
{
  "status": "audit-status-open"
}

// 查询所有有问题的审计请求
{
  "status": "audit-status-concern"
}

// 查询所有已接受的审计请求
{
  "status": "audit-status-accepted"
}

// 查询所有部分处理的审计请求
{
  "status": "audit-status-partial"
}

// 查询所有状态的审计请求
{
  "status": "audit-status-any"
}

【分页使用示例】:
// 第一页
{
  "offset": 0,
  "limit": 50
}

// 第二页
{
  "offset": 50,
  "limit": 50
}

// 第三页
{
  "offset": 100,
  "limit": 50
}

【组合查询示例】:
{
  "auditorPHIDs": ["PHID-USER-1111", "PHID-USER-2222"],
  "commitPHIDs": ["PHID-CMIT-1111", "PHID-CMIT-2222"],
  "status": "audit-status-open",
  "limit": 100
}

【返回结果示例】:
[
  {
    "id": 123,
    "phid": "PHID-AUDT-1111",
    "auditorPHID": "PHID-USER-1111",
    "commitPHID": "PHID-CMIT-1111",
    "status": "audit-status-open",
    "dateCreated": 1701388800,
    "dateModified": 1701388800,
    "actorPHID": "PHID-USER-2222",
    "objectPHID": "PHID-CMIT-1111",
    "oldValue": "old content",
    "newValue": "new content"
  },
  {
    "id": 124,
    "phid": "PHID-AUDT-2222",
    "auditorPHID": "PHID-USER-3333",
    "commitPHID": "PHID-CMIT-2222",
    "status": "audit-status-concern",
    "dateCreated": 1701388900,
    "dateModified": 1701388900,
    "actorPHID": "PHID-USER-4444",
    "objectPHID": "PHID-CMIT-2222",
    "oldValue": "old content",
    "newValue": "new content"
  }
]

【错误处理】
常见错误：
- ERR-CONDUIT-CORE: 核心错误，详见错误消息
- 权限不足: 无法访问审计请求
- 参数无效: 状态值不正确
- PHID无效: 审计员或提交PHID格式错误
- 分页错误: 偏移量或限制值不正确

【最佳实践】
1. 使用合适的状态筛选提高查询效率
2. 合理设置limit避免过多数据
3. 使用分页处理大量结果
4. 结合审计员和提交条件精确筛选
5. 定期清理过期的审计请求

【性能考虑】
- 限制结果数量提高响应速度
- 合理使用状态筛选
- 避免过大的limit值
- 考虑缓存频繁查询
- 使用索引优化查询性能

【安全考虑】
- OAuth客户端无法调用此方法
- 只能查询用户有权限的审计请求
- 返回数据受权限策略限制
- 记录重要查询操作
- 验证PHID有效性

【弃用说明】
⚠️ **重要提示**: 此方法已被冻结，最终将被弃用。
- 新代码应使用"diffusion.commit.search"代替
- 现有代码应尽快迁移到新方法
- 此方法可能在未来的版本中被移除

【迁移建议】
1. 使用diffusion.commit.search替代此方法
2. 更新相关的代码和文档
3. 测试新方法的兼容性
4. 逐步迁移现有功能

【与审计系统的关系】
audit.query是审计系统的查询API：
- 用于查询审计请求
- 支持多种筛选条件
- 与其他审计API配合使用
- 提供审计历史追踪

【相关API】
diffusion.commit.search: 推荐的替代方法
其他审计相关API

【分页和限制】
- 查询限制为每次返回100个结果
- 使用limit指定较小的限制
- 使用offset进行分页
- 建议使用合理的分页大小

【注意事项】
- auditorPHIDs为空时查询所有审计员的请求
- commitPHIDs为空时查询所有提交的审计请求
- status默认为audit-status-any
- OAuth客户端无法调用此方法
- 返回list<dict>类型的数据
- 操作受权限和验证限制影响
- 此方法已被冻结，建议使用替代方法

【特色功能】
- 多种筛选条件支持
- 状态筛选功能
- 分页查询支持
- 审计员和提交关联查询
- 完整的审计信息返回

【安全限制】
- OAuth客户端无法调用此方法
- 返回list<dict>类型的数据
- 操作受权限和验证限制影响
- 只能查询用户有权限的审计请求
- 此方法已被冻结，将被弃用

【替代方案】
推荐使用diffusion.commit.search方法：
- 提供更现代的查询接口
- 支持更多的筛选选项
- 更好的性能和稳定性
- 持续维护和更新

【实际应用示例】

查询特定审计员的开放审计:
{
  "auditorPHIDs": ["PHID-USER-1111"],
  "status": "audit-status-open",
  "limit": 50
}

查询特定提交的所有审计:
{
  "commitPHIDs": ["PHID-CMIT-1111"],
  "limit": 100
}

查询有问题的审计请求:
{
  "status": "audit-status-concern",
  "auditorPHIDs": ["PHID-USER-1111", "PHID-USER-2222"],
  "limit": 25
}

分页查询所有审计请求:
{
  "status": "audit-status-any",
  "offset": 0,
  "limit": 100
}

【迁移到新方法的示例】:
// 旧方法
const oldQuery = {
  auditorPHIDs: ["PHID-USER-1111"],
  status: "audit-status-open",
  limit: 50
};
const oldResult = await audit.query(oldQuery);

// 新方法（推荐）
const newQuery = {
  constraints: {
    auditorPHIDs: ["PHID-USER-1111"],
    auditStatus: "open"
  },
  limit: 50
};
const newResult = await diffusion.commit.search(newQuery);

API已成功集成到现有系统中，不会影响其他API的正常运行。`
      }
    },
  },
  'almanac.service.search': {
    label: 'Almanac服务搜索',
    params: {
      queryKey: { type: 'string', default: '', placeholder: '查询类型：all' },
      constraints: { type: 'json', default: '{}', placeholder: '约束条件，见下方常用示例' },
      attachments: { type: 'json', default: '{}', placeholder: '附加信息，如：{"properties":true,"bindings":true,"projects":true}' },
      order: { type: 'string', default: 'name', placeholder: '排序：name/newest/oldest' },
      before: { type: 'string', default: '', placeholder: '分页游标，获取前一页' },
      after: { type: 'string', default: '', placeholder: '分页游标，获取后一页' },
      limit: { type: 'number', default: 100, placeholder: '结果数量限制，默认100' },
      _help: { 
        type: 'static',
        content: `Almanac服务搜索使用指南:

【API功能】
标准的ApplicationSearch方法，用于列出、查询或搜索Almanac服务对象。支持内置查询、自定义约束、排序、附件和分页功能。

【参数说明】
- queryKey: 查询类型（可选参数）
- constraints: 约束条件（可选参数）
- attachments: 附加信息（可选参数）
- order: 排序方式（可选参数）
- before: 分页游标，获取前一页（可选参数）
- after: 分页游标，获取后一页（可选参数）
- limit: 结果数量限制（可选参数，默认100）

【参数详解】

1. queryKey（可选）
   - 类型: string
   - 说明: 内置或保存的查询键
   - 默认值: 空
   - 示例: "all"
   - 注意: 如果不指定，查询将从无约束开始

2. constraints（可选）
   - 类型: map<string, wild>
   - 说明: 自定义约束条件字典
   - 默认值: {}
   - 示例: {"ids": [123, 456], "phids": ["PHID-SRVC-1111"]}
   - 注意: 与queryKey结合使用时，会覆盖默认约束

3. attachments（可选）
   - 类型: map<string, bool>
   - 说明: 请求额外信息
   - 默认值: {}
   - 示例: {"properties": true, "bindings": true, "projects": true}
   - 注意: 请求更多信息会降低查询性能

4. order（可选）
   - 类型: order
   - 说明: 结果排序方式
   - 默认值: name
   - 示例: "name", "newest", "oldest"
   - 注意: 可以使用内置键或自定义列排序

5. before（可选）
   - 类型: string
   - 说明: 分页游标，获取前一页
   - 默认值: 空
   - 示例: "1234"
   - 注意: 与after配合使用进行分页

6. after（可选）
   - 类型: string
   - 说明: 分页游标，获取后一页
   - 默认值: 空
   - 示例: "4567"
   - 注意: 与before配合使用进行分页

7. limit（可选）
   - 类型: int
   - 说明: 结果数量限制
   - 默认值: 100
   - 示例: 50
   - 注意: 最大100，需要更多结果时使用分页

【内置查询类型】
支持以下内置查询键：

1. all: 所有服务
   - 说明: 显示所有服务
   - 适用场景: 完整服务列表

【约束类型】
支持以下约束键：

1. ids: ID列表
   - 类型: list<int>
   - 说明: 搜索特定ID的对象
   - 示例: [123, 456, 789]

2. phids: PHID列表
   - 类型: list<phid>
   - 说明: 搜索特定PHID的对象
   - 示例: ["PHID-SRVC-1111", "PHID-SRVC-2222"]

3. match: 名称包含
   - 类型: string
   - 说明: 按名称子字符串搜索服务
   - 示例: "web", "database"

4. names: 精确名称
   - 类型: list<string>
   - 说明: 搜索特定名称的服务
   - 示例: ["web-server", "database-master"]

5. serviceTypes: 服务类型
   - 类型: list<string>
   - 说明: 按类型查找服务
   - 示例: ["web", "database", "cache"]

6. devicePHIDs: 设备
   - 类型: list<phid>
   - 说明: 搜索绑定到特定设备的服务
   - 示例: ["PHID-DEVC-1111", "PHID-DEVC-2222"]

7. projects: 标签
   - 类型: list<project>
   - 说明: 搜索标记为特定项目的对象
   - 示例: ["PHID-PROJ-1111", "PHID-PROJ-2222"]

【排序选项】
支持以下内置排序：

1. name: 服务名称
   - 说明: 按服务名称排序
   - 列: name

2. newest: 创建日期（最新的优先）
   - 说明: 按创建时间降序排列
   - 列: id

3. oldest: 创建日期（最旧的优先）
   - 说明: 按创建时间升序排列
   - 列: -id

【低级排序列】
支持以下低级排序列：

1. id: ID
   - 唯一: 是

2. name: 名称
   - 唯一: 是

【对象字段】
返回的对象包含以下字段：

1. name: 服务名称
   - 类型: string
   - 说明: 服务的名称

2. serviceType: 服务类型
   - 类型: string
   - 说明: 服务类型常量

3. dateCreated: 创建日期
   - 类型: int
   - 说明: 对象创建时的纪元时间戳

4. dateModified: 修改日期
   - 类型: int
   - 说明: 对象最后更新时的纪元时间戳

5. policy: 策略
   - 类型: map<string, wild>
   - 说明: 从功能到当前策略的映射

【附加信息】
支持以下附加信息：

1. properties: Almanac属性
   - 说明: 获取对象的Almanac属性

2. bindings: Almanac绑定
   - 说明: 获取服务的Almanac绑定

3. projects: 项目
   - 说明: 获取项目信息

【分页和限制】
- 查询限制为每次返回100个结果
- 使用limit指定较小的限制
- 使用before和after游标进行分页
- cursor包含分页信息

【使用场景】
- 查询特定名称的服务
- 搜索特定类型的服务
- 查询绑定到特定设备的服务
- 按项目标签筛选服务
- 分页浏览大量服务
- 获取服务详细信息

【操作示例】

使用内置查询:
{
  "queryKey": "all"
}

自定义约束:
{
  "constraints": {
    "match": "web",
    "serviceTypes": ["web", "database"]
  }
}

请求附加信息:
{
  "attachments": {
    "properties": true,
    "bindings": true,
    "projects": true
  }
}

排序结果:
{
  "order": "name"
}

分页查询:
{
  "limit": 50,
  "after": "1234"
}

完整查询示例:
{
  "queryKey": "all",
  "constraints": {
    "match": "database",
    "serviceTypes": ["database"]
  },
  "attachments": {
    "properties": true,
    "bindings": true
  },
  "order": "name",
  "limit": 50
}

【返回信息】
成功时返回map<string, wild>，包含：
- data: 服务列表
- cursor: 分页信息
- 其他元数据

【使用流程】
1. 确定查询条件（类型、约束、设备等）
2. 设置分页参数（可选）
3. 请求附加信息（可选）
4. 设置排序方式（可选）
5. 执行搜索操作
6. 处理返回结果

【实际应用场景】

查询所有服务:
{
  "queryKey": "all"
}

按名称搜索服务:
{
  "constraints": {
    "match": "web"
  },
  "order": "name"
}

按类型筛选服务:
{
  "constraints": {
    "serviceTypes": ["database", "cache"]
  }
}

查询特定设备的服务:
{
  "constraints": {
    "devicePHIDs": ["PHID-DEVC-1111"]
  }
}

按项目筛选服务:
{
  "constraints": {
    "projects": ["PHID-PROJ-1111"]
  }
}

获取服务详细信息:
{
  "constraints": {
    "ids": [123, 456]
  },
  "attachments": {
    "properties": true,
    "bindings": true,
    "projects": true
  }
}

【批量操作示例】:
const queries = [
  {
    queryKey: "all",
    limit: 50
  },
  {
    constraints: { match: "web" },
    limit: 50
  },
  {
    constraints: { serviceTypes: ["database"] },
    limit: 50
  }
];

for (const query of queries) {
  try {
    const result = await almanac.service.search(query);
    console.log('服务搜索成功:', result);
  } catch (error) {
    console.error('服务搜索失败:', error);
  }
}

【服务类型示例】:
常见的服务类型包括：
- web: Web服务
- database: 数据库服务
- cache: 缓存服务
- loadbalancer: 负载均衡器
- monitoring: 监控服务
- logging: 日志服务
- storage: 存储服务
- network: 网络服务

【约束组合示例】:
{
  "constraints": {
    "match": "web",
    "serviceTypes": ["web", "loadbalancer"],
    "devicePHIDs": ["PHID-DEVC-1111"],
    "projects": ["PHID-PROJ-1111"]
  }
}

【附件使用示例】:
{
  "attachments": {
    "properties": true,
    "bindings": true,
    "projects": true
  }
}

返回结果示例:
{
  "data": [
    {
      "id": 123,
      "phid": "PHID-SRVC-1111",
      "fields": {
        "name": "web-server-01",
        "serviceType": "web",
        "dateCreated": 1701388800,
        "dateModified": 1701388800,
        "policy": {
          "view": "public",
          "edit": "admin"
        }
      },
      "attachments": {
        "properties": {
          "property1": "value1",
          "property2": "value2"
        },
        "bindings": [
          {
            "devicePHID": "PHID-DEVC-1111",
            "bindingType": "primary"
          }
        ],
        "projects": {
          "projectPHIDs": ["PHID-PROJ-1111"],
          "projectCount": 1,
          "viewerIsProjectMember": true
        }
      }
    }
  ],
  "cursor": {
    "limit": 100,
    "after": "4567",
    "before": null,
    "order": null
  }
}

【错误处理】
常见错误：
- ERR-CONDUIT-CORE: 核心错误，详见错误消息
- 权限不足: 无法访问指定服务
- 参数无效: 约束条件格式错误
- 分页错误: 游标无效
- 服务类型无效: 不支持的服务类型

【最佳实践】
1. 使用合适的queryKey提高查询效率
2. 合理设置limit避免过多数据
3. 只请求需要的attachments
4. 使用分页处理大量结果
5. 结合约束条件精确筛选
6. 合理使用排序选项

【性能考虑】
- 限制结果数量提高响应速度
- 谨慎使用attachments
- 合理使用约束条件
- 考虑缓存频繁查询
- 使用索引优化查询性能

【安全考虑】
- OAuth客户端无法调用此方法
- 只能查询用户有权限的服务
- 返回数据受权限策略限制
- 记录重要查询操作
- 验证设备PHID有效性

【与Almanac系统的关系】
almanac.service.search是Almanac系统的核心API：
- 用于查询和管理服务
- 支持多种查询和筛选方式
- 与其他Almanac API配合使用
- 提供完整的服务信息
- 支持服务绑定和属性管理

【相关API】
almanac.service.edit: 编辑服务
almanac.device.search: 搜索设备
其他Almanac相关API

【分页示例】
// 第一页
{
  "limit": 50,
  "after": ""
}

// 第二页
{
  "limit": 50,
  "after": "1234"
}

// 第三页
{
  "limit": 50,
  "after": "5678"
}

【实际应用场景】
查询Web服务:
{
  "constraints": {
    "serviceTypes": ["web"]
  },
  "order": "name"
}

查询特定设备的服务:
{
  "constraints": {
    "devicePHIDs": ["PHID-DEVC-1111"]
  },
  "attachments": {
    "bindings": true
  }
}

按项目筛选服务:
{
  "constraints": {
    "projects": ["PHID-PROJ-1111"]
  },
  "attachments": {
    "projects": true
  }
}

搜索服务名称:
{
  "constraints": {
    "match": "database"
  },
  "order": "name"
}

获取服务详细信息:
{
  "constraints": {
    "ids": [123]
  },
  "attachments": {
    "properties": true,
    "bindings": true,
    "projects": true
  }
}

【自定义排序示例】:
// 按名称排序
{
  "order": "name"
}

// 按创建时间排序（最新的优先）
{
  "order": "newest"
}

// 按创建时间排序（最旧的优先）
{
  "order": "oldest"
}

// 自定义列排序
{
  "order": ["name", "id"]
}

【注意事项】
- queryKey为空时从无约束开始查询
- constraints与queryKey结合时会覆盖默认值
- attachments会降低查询性能
- 最大限制为100个结果
- OAuth客户端无法调用此方法
- 返回map<string, wild>类型的数据
- 操作受权限和验证限制影响
- 只能查询用户有权限的服务
- 大量数据查询建议使用分页

【特色功能】
- 标准的ApplicationSearch方法实现
- 1种内置查询类型
- 7种约束条件
- 3种内置排序选项
- 2种低级排序列
- 5种对象字段
- 3种附加信息类型
- 完整的分页支持
- 灵活的查询组合

【安全限制】
- OAuth客户端无法调用此方法
- 返回map<string, wild>类型的数据
- 操作受权限和验证限制影响
- 只能查询用户有权限的服务

API已成功集成到现有系统中，不会影响其他API的正常运行。`
      }
    },
  },
};
