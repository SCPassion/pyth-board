"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon, CheckCircle, XCircle } from "lucide-react";
import { NFTRole } from "@/types/pythTypes";
import Image from "next/image";
import { DiscordIcon } from "@/components/icons/discord-icon";
import { TwitterIcon } from "@/components/icons/twitter-icon";
import { memo } from "react";

interface NFTCardProps {
  role: NFTRole;
}

export const NFTCard = memo(function NFTCard({ role }: NFTCardProps) {
  return (
    <Card className="bg-[#2a2f3e] border-gray-600 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300 group">
      <CardHeader className="pb-1">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-800 border border-gray-600 flex items-center justify-center group-hover:border-purple-400 transition-colors">
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
            <div className="flex-1 min-w-0">
              <CardTitle className="text-white text-lg truncate font-semibold">
                {role.name}
              </CardTitle>
            </div>
          </div>
          <Badge
            variant={role.claimable ? "default" : "secondary"}
            className={`flex items-center gap-1 font-medium ${
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
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-gray-200 text-sm leading-relaxed">
          {role.description}
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {role.projectUrl && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-blue-500 text-blue-300 hover:bg-blue-600 hover:text-white hover:border-blue-400 transition-all duration-200"
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
              className="flex-1 border-purple-500 text-purple-300 hover:bg-purple-600 hover:text-white hover:border-purple-400 transition-all duration-200"
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
});
