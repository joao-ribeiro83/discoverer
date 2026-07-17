import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function MapsListPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Maps</h2>
        <p className="text-muted-foreground">Browse and manage your visual maps.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Placeholder</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">This page is coming soon.</p>
        </CardContent>
      </Card>
    </div>
  )
}
