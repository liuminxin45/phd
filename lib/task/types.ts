export interface Subtask {
  id: number;
  title: string;
  completed: boolean;
  status?: string;
  expanded: boolean;
  children: Subtask[];
  hasChildren?: boolean;
  isLoadingChildren?: boolean;
}
