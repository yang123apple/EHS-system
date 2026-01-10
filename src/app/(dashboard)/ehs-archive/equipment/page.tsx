import { getEquipments } from '@/app/actions/equipment'
import EquipmentView from './EquipmentView'

export default async function EquipmentArchivePage() {
  const equipments = await getEquipments()

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-white">
        <h2 className="text-lg font-medium">设备档案 (Equipment Archive)</h2>
        <p className="text-sm text-slate-500">Manage records for special equipment.</p>
      </div>

      <div className="flex-1 overflow-hidden">
        <EquipmentView equipments={equipments} />
      </div>
    </div>
  )
}
