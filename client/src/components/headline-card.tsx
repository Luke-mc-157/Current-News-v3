import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Clock, TrendingUp, Tag, Newspaper } from "lucide-react";
import type { Headline } from "@shared/schema";

interface HeadlineCardProps {
  headline: Headline;
}

export default function HeadlineCard({ headline }: HeadlineCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Technology: "bg-blue-100 text-blue-700",
      Environment: "bg-green-100 text-green-700",
      Space: "bg-purple-100 text-purple-700",
      Healthcare: "bg-red-100 text-red-700",
      Finance: "bg-yellow-100 text-yellow-700",
      Science: "bg-indigo-100 text-indigo-700",
      Politics: "bg-gray-100 text-gray-700",
      Sports: "bg-orange-100 text-orange-700",
    };
    return colors[category] || "bg-slate-100 text-slate-700";
  };

  const timeAgo = new Date(headline.createdAt).toLocaleString();

  return (
    <Card className="shadow-sm border border-slate-200">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between mb-3 sm:mb-4 gap-2">
          <h4 className="text-base sm:text-lg font-semibold text-slate-900 leading-tight flex-1">
            {headline.title}
          </h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-shrink-0 h-8 w-8 p-0 sm:h-9 sm:w-9"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>

        <p className="text-sm sm:text-base text-slate-600 mb-3 sm:mb-4 leading-relaxed">
          {headline.summary}
        </p>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
          <Badge className={`${getCategoryColor(headline.category)} text-xs`}>
            <Tag className="w-3 h-3 mr-1" />
            {headline.category}
          </Badge>
          <span className="text-xs sm:text-sm text-slate-500 flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            {timeAgo}
          </span>
          <span className="text-xs sm:text-sm text-slate-500 flex items-center">
            <TrendingUp className="w-3 h-3 mr-1" />
            {headline.engagement}
          </span>
        </div>

        {isExpanded && (
          <div className="border-t border-slate-200 pt-3 sm:pt-4 space-y-4 sm:space-y-6">
            <div>
              <h5 className="text-xs sm:text-sm font-medium text-slate-700 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-1 text-black" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
                </svg>
                X Posts ({headline.sourcePosts.length})
              </h5>
              <div className="space-y-2">
                {headline.sourcePosts.map((post, index) => (
                  <a
                    key={index}
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    {post.handle || post.author_name}
                  </a>
                ))}
              </div>
            </div>

            {headline.supportingArticles && headline.supportingArticles.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                  <Newspaper className="w-4 h-4 mr-1" />
                  Supporting Articles ({headline.supportingArticles.length})
                </h5>
                <div className="space-y-2">
                  {headline.supportingArticles.map((article, index) => (
                    <a
                      key={index}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      • {article.title}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
