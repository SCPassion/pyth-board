"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

interface Wallet {
  id: string
  address: string
  name: string
  totalStaked: number
  totalRewards: number
  unstaking: number
  validators: number
}

interface DashboardChartsProps {
  wallets: Wallet[]
}

export function DashboardCharts({ wallets }: DashboardChartsProps) {
  // Mock historical data
  const stakingHistory = [
    { date: "Jan", totalStaked: 18000, rewards: 1200 },
    { date: "Feb", totalStaked: 19500, rewards: 1350 },
    { date: "Mar", totalStaked: 21000, rewards: 1500 },
    { date: "Apr", totalStaked: 22800, rewards: 1680 },
    { date: "May", totalStaked: 24170, rewards: 1920 },
    { date: "Jun", totalStaked: 24170, rewards: 1920 },
  ]

  const walletData = wallets.map((wallet) => ({
    name: wallet.name,
    staked: wallet.totalStaked,
    rewards: wallet.totalRewards,
  }))

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="transition-all duration-200 hover:shadow-lg">
        <CardHeader>
          <CardTitle>Staking History</CardTitle>
          <CardDescription>Your total staked amount and rewards over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              totalStaked: {
                label: "Total Staked",
                color: "hsl(var(--chart-1))",
              },
              rewards: {
                label: "Rewards",
                color: "hsl(var(--chart-2))",
              },
            }}
            className="h-[300px]"
          >
            <AreaChart data={stakingHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="totalStaked"
                stackId="1"
                stroke="var(--color-totalStaked)"
                fill="var(--color-totalStaked)"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="rewards"
                stackId="1"
                stroke="var(--color-rewards)"
                fill="var(--color-rewards)"
                fillOpacity={0.8}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="transition-all duration-200 hover:shadow-lg">
        <CardHeader>
          <CardTitle>Wallet Distribution</CardTitle>
          <CardDescription>Staked amount and rewards by wallet</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              staked: {
                label: "Staked",
                color: "hsl(var(--chart-3))",
              },
              rewards: {
                label: "Rewards",
                color: "hsl(var(--chart-4))",
              },
            }}
            className="h-[300px]"
          >
            <BarChart data={walletData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="staked" fill="var(--color-staked)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="rewards" fill="var(--color-rewards)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
