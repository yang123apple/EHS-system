import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronDown, Briefcase, Check } from 'lucide-react';

// 复用 OrgNode 接口
interface OrgNode {
  id: string;
  name: string;
  parentId: string | null;
  children?: OrgNode[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (deptId: string, deptName: string) => void;
  selectedDeptId?: string; // 当前选中的ID，用于高亮
}

export default function DepartmentSelectModal({ isOpen, onClose, onSelect, selectedDeptId }: Props) {
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/org'); // 复用现有的 API
      if (res.ok) {
        setTree(await res.json());
      }
    } catch (e) {
      console.error("加载组织架构失败", e);
    } finally {
      setIsLoading(false);
    }
  };

  // 递归渲染树节点
  const TreeNode = ({ node, level }: { node: OrgNode, level: number }) => {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedDeptId === node.id;

    return (
      <div className="select-none">
        <div 
            onClick={() => onSelect(node.id, node.name)}
            className={`flex items-center gap-2 p-2 my-1 rounded cursor-pointer transition-colors
                ${isSelected ? 'bg-blue-100 border-blue-300 text-blue-800' : 'hover:bg-slate-100 text-slate-700'}
                ${level === 0 ? 'font-bold' : ''}
            `}
            style={{ marginLeft: `${level * 24}px` }}
        >
          {/* 展开/折叠按钮 */}
          <div 
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className={`w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 text-slate-400 shrink-0 ${!hasChildren && 'invisible'}`}
          >
             {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>

          <Briefcase size={16} className={isSelected ? "text-blue-600" : "text-slate-400"} />
          <span className="text-sm flex-1">{node.name}</span>
          
          {isSelected && <Check size={16} className="text-blue-600 mr-2" />}
        </div>

        {/* 子节点 */}
        {expanded && hasChildren && (
          <div className="border-l border-slate-200 ml-[1.1rem]">
             {node.children!.map(child => (
                <TreeNode key={child.id} node={child} level={level + 1} />
             ))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white rounded-xl w-full max-w-lg h-[80vh] flex flex-col shadow-2xl animate-fade-in">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                <h3 className="font-bold text-lg text-slate-800">选择部门</h3>
                <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full text-slate-500"><X size={20}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {isLoading ? (
                    <div className="text-center py-10 text-slate-400">加载组织架构中...</div>
                ) : tree.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">暂无部门数据</div>
                ) : (
                    tree.map(root => <TreeNode key={root.id} node={root} level={0} />)
                )}
            </div>
            
            <div className="p-4 border-t bg-slate-50 rounded-b-xl text-xs text-slate-400 text-center">
                点击上方部门名称即可选中
            </div>
        </div>
    </div>
  );
}