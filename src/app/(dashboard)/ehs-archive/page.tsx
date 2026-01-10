import { redirect } from 'next/navigation'

export default function EHSArchivePage() {
  // Redirect to the default view (Enterprise)
  redirect('/ehs-archive/enterprise')
}
