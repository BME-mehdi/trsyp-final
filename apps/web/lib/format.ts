const dt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const d = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' })
export const formatDateTime = (iso: string) => dt.format(new Date(iso))
export const formatDay = (iso: string) => d.format(new Date(iso))
