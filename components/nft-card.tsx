"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon, CheckCircle, XCircle } from "lucide-react";
import { NFTRole } from "@/types/pythTypes";
import Image from "next/image";
import { DiscordIcon } from "@/components/icons/discord-icon";
import { TwitterIcon } from "@/components/icons/twitter-icon";

interface NFTCardProps {
  role: NFTRole;
}

export function NFTCard({ role }: NFTCardProps) {
  return (
    <Card className="group rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)] transition-all duration-300 hover:border-white/15">
      <CardHeader className="px-6 pt-6 pb-2">
        <div className="flex flex-col gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/8 bg-[#2f2942] transition-colors group-hover:border-white/15">
              {role.image ? (
                <Image
                  src={role.image}
                  alt={role.name}
                  width={64}
                  height={64}
                  className="object-cover w-full h-full"
                />
              ) : (
                <ImageIcon className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-white text-lg truncate font-semibold">
                {role.name}
              </CardTitle>
            </div>
          </div>
          <div className="flex justify-start">
            <Badge
              variant={role.claimable ? "default" : "secondary"}
              className={`shrink-0 rounded-xl px-2.5 py-1 flex items-center gap-1 font-medium ${
                role.claimable
                  ? "bg-green-600 hover:bg-green-500 text-white border-green-500"
                  : "bg-red-600 hover:bg-red-500 text-white border-red-500"
              }`}
            >
              {role.claimable ? (
                <>
                  <CheckCircle className="w-3 h-3" />
                  Claimable
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3" />
                  Not Claimable
                </>
              )}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-6 pb-6">
        <p className="text-sm leading-relaxed text-[#d8d3ea]">
          {role.description}
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {role.projectUrl && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-xl border-blue-500/70 bg-[#2f2942] text-blue-300 hover:border-blue-400 hover:bg-blue-600 hover:text-white transition-all duration-200"
              onClick={() => window.open(role.projectUrl, "_blank")}
            >
              <TwitterIcon className="w-4 h-4 mr-2" />
              Twitter
            </Button>
          )}
          {role.discordInviteUrl && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-xl border-purple-500/70 bg-[#2f2942] text-purple-300 hover:border-purple-400 hover:bg-purple-600 hover:text-white transition-all duration-200"
              onClick={() => window.open(role.discordInviteUrl, "_blank")}
            >
              <DiscordIcon className="w-4 h-4 mr-2" />
              Join Discord
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
