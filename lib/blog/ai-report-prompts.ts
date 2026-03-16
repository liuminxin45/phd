/**
 * LLM Prompt templates for AI Weekly Report generation
 */

export interface TaskInfo {
  id: number;
  phid: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  projectNames: string[];
  dateCreated: number;
  dateModified: number;
  dateClosed?: number;
  comments?: string[];
}

export interface ReportGenerationInput {
  dateRange: string;
  completedTasks: TaskInfo[];
  ongoingTasks: TaskInfo[];
}

/**
 * Generate the report generation prompt
 */
export function buildGenerateReportPrompt(input: ReportGenerationInput): string {
  const { dateRange, completedTasks, ongoingTasks } = input;

  const completedSection = formatTasksForPrompt(completedTasks, '已完成任务');
  const ongoingSection = formatTasksForPrompt(ongoingTasks, '进行中任务');

  return `你是一位专业的技术周报撰写助手。请根据以下任务数据生成一份工作周报。

【时间范围】${dateRange}

${completedSection}

${ongoingSection}

【输出格式要求】
1. 使用专业的职场语言，正式但不生硬
2. 内容分两部分：
   - **上周已完成工作**：按项目/类别分组，列出上周关闭的任务，结合评论历史补充完成细节
   - **进行中工作（未完成）**：列出当前仍在进行的任务，说明当前进展
3. 每个任务说明要点：
   - 任务标题和ID（如 T12345）
   - 完成的关键成果或技术点（已完成任务）
   - 当前进展状态（进行中任务）
4. 如果任务有评论历史，提取有价值的信息补充到描述中
5. 只输出 Markdown 格式，不要任何解释性文字

【示例输出格式】
## 上周已完成工作

### 项目：XXX
- **T12345: 任务标题**
  - 完成内容：xxx
  - 关键成果：xxx

### 项目：YYY
- **T12346: 任务标题**
  - ...

## 进行中工作（未完成）

- **T12350: 任务标题** [优先级: 高]
  - 当前进展：xxx
  - 预计完成情况：xxx
`;
}

/**
 * Generate the merge and polish prompt
 */
export function buildMergePolishPrompt(reportMarkdown: string, manualNotes: string): string {
  return `你是一位周报编辑。请将用户的口语化备注合并润色到现有周报中。

【用户备注】
${manualNotes}

【现有周报】
${reportMarkdown}

【要求】
1. 将用户备注中的内容自然地融入周报
   - 用户提到的"上周完成"内容归入"上周已完成工作"部分
   - 用户提到的"下周计划"归入"进行中工作"或新增"下周计划"部分
2. 保持原有结构和格式
3. 适当扩展细节，使内容更充实专业
4. 使用正式的职场语言
5. 输出最终 Markdown 报告，不要任何解释性文字`;
}

/**
 * Format tasks for the prompt
 */
function formatTasksForPrompt(tasks: TaskInfo[], title: string): string {
  if (tasks.length === 0) {
    return `【${title}】\n无`;
  }

  const taskDescriptions = tasks.map((task, index) => {
    const lines = [
      `任务 ${index + 1}:`,
      `  - ID: T${task.id} (${task.phid})`,
      `  - 标题: ${task.title}`,
      `  - 状态: ${task.status}`,
      `  - 优先级: ${task.priority}`,
      `  - 项目: ${task.projectNames.join(', ') || '未分配'}`,
    ];

    if (task.description && typeof task.description === 'string') {
      lines.push(`  - 描述: ${task.description.slice(0, 500)}${task.description.length > 500 ? '...' : ''}`);
    }

    if (task.comments && task.comments.length > 0) {
      const relevantComments = task.comments
        .filter(c => c && c.trim().length > 10)
        .slice(0, 3);
      if (relevantComments.length > 0) {
        lines.push(`  - 相关评论:`);
        relevantComments.forEach(comment => {
          lines.push(`    * ${comment.slice(0, 200)}${comment.length > 200 ? '...' : ''}`);
        });
      }
    }

    return lines.join('\n');
  });

  return `【${title}】\n${taskDescriptions.join('\n\n')}`;
}
