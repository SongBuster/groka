import { useSessionExpiredDetector } from '../hooks/useSessionExpiredDetector'
import { useDialog } from '../hooks/useDialog'

export default function SessionExpiredHandler() {
  useSessionExpiredDetector()
  const { DialogComponent } = useDialog()
  
  return <DialogComponent />
}
