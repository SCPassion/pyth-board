"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Image as ImageIcon, Filter, Search, X } from "lucide-react";
import { NFTRole } from "@/types/pythTypes";
import { NFTCard } from "@/components/nft-card";

interface NFTRolesProps {
  nftRoles: NFTRole[];
}

type FilterType = "all" | "claimable" | "not-claimable";

export function NFTRoles({ nftRoles }: NFTRolesProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRoles = nftRoles.filter((role) => {
    // Apply claimable filter
    const matchesClaimableFilter =
      filter === "all" ||
      (filter === "claimable" && role.claimable) ||
      (filter === "not-claimable" && !role.claimable);

    // Apply search filter
    const matchesSearch =
      searchQuery === "" ||
      role.name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesClaimableFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white">
          Pythenians Partnerships
        </h2>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-gray-400 border-gray-600">
            {filteredRoles.length}{" "}
            {filter === "all"
              ? "Total"
              : filter === "claimable"
              ? "Claimable"
              : "Not Claimable"}{" "}
            Roles
          </Badge>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="flex gap-4 items-center justify-between">
        {/* Search Box */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="Search project names..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-purple-400 focus:ring-purple-400"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            className={`flex items-center gap-2 ${
              filter === "all"
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
            }`}
          >
            <Filter className="w-4 h-4" />
            All Roles
          </Button>
          <Button
            variant={filter === "claimable" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("claimable")}
            className={`flex items-center gap-2 ${
              filter === "claimable"
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
            }`}
          >
            Claimable
          </Button>
          <Button
            variant={filter === "not-claimable" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("not-claimable")}
            className={`flex items-center gap-2 ${
              filter === "not-claimable"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
            }`}
          >
            Not Claimable
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRoles.map((role) => (
          <NFTCard key={role.id} role={role} />
        ))}
      </div>

      {filteredRoles.length === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            {searchQuery
              ? `No projects found for "${searchQuery}"`
              : filter === "all"
              ? "No NFT Roles Available"
              : filter === "claimable"
              ? "No Claimable Roles"
              : "No Non-Claimable Roles"}
          </h3>
          <p className="text-gray-400">
            {searchQuery
              ? "Try adjusting your search terms or filters."
              : filter === "all"
              ? "Check back later for new NFT role opportunities."
              : filter === "claimable"
              ? "No claimable roles available at the moment."
              : "No non-claimable roles found."}
          </p>
        </div>
      )}
    </div>
  );
}
