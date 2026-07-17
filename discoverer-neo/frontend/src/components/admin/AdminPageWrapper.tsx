import type { ReactNode } from 'react'

interface AdminPageWrapperProps {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}

export function AdminPageWrapper({ title, description, action, children }: AdminPageWrapperProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}
