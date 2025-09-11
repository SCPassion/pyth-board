"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Users,
  Image as ImageIcon,
  MessageCircle,
} from "lucide-react";
import { NFTRole } from "@/types/pythTypes";
import Image from "next/image";
import { DiscordIcon } from "@/components/icons/discord-icon";
import { TwitterIcon } from "@/components/icons/twitter-icon";

interface NFTCardProps {
  role: NFTRole;
}

export function NFTCard({ role }: NFTCardProps) {
  return (
    <Card className="bg-[#2a2f3e] border-gray-700 hover:border-gray-600 transition-colors">
      <CardHeader className="pb-1">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-800 flex items-center justify-center">
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
              <CardTitle className="text-white text-lg truncate">
                {role.name}
              </CardTitle>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          {role.description}
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {role.projectUrl && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
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
              className="flex-1 border-purple-600 text-purple-300 hover:bg-purple-700 hover:text-white"
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
