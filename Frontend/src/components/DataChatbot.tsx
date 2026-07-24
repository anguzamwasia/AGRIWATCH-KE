import React, { useState, useRef, useEffect } from "react";
import { API_BASE_URL } from "../config";
import axios from "axios";
import { Send, Bot, User, Loader2, Map as MapIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Message {
  id: string;
  type: "user" | "bot";
  content: string;
  mapUrl?: string;
}

export const DataChatbot = ({ selectedCounty, selectedCrop }: { selectedCounty: string, selectedCrop: string }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "bot",
      content: `Hello! I am your AI Advisor for the National Food Security Dashboard. You can ask me about baseline yields, area cultivated, and total production across any county in our database. How can I help you today?`,
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), type: "user", content: input };
    
    // Format history for backend
    const history = messages.map(m => ({
      role: m.type === "user" ? "user" : "model",
      content: m.content
    }));

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/chat`, {
        query: userMessage.content,
        context_county: selectedCounty,
        context_crop: selectedCrop,
        history: history
      });

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: response.data.answer,
        mapUrl: response.data.map_url
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: "I'm sorry, my database connection seems to be offline right now."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 rounded-3xl overflow-hidden shadow-inner">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
        <div className="p-2 bg-emerald-500/10 rounded-lg">
          <Bot className="text-emerald-400 h-5 w-5" />
        </div>
        <div>
          <h2 className="font-bold text-slate-100">AI Database Advisor</h2>
          <p className="text-xs text-emerald-500 font-semibold tracking-wider">ONLINE</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.type === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.type === "user" ? "bg-emerald-600" : "bg-slate-800 border border-slate-700"}`}>
              {msg.type === "user" ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-emerald-400" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl p-4 ${msg.type === "user" ? "bg-emerald-600 text-white" : "bg-slate-800 border border-slate-700 text-slate-200"}`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              {msg.mapUrl && (
                <div className="mt-3 rounded-xl overflow-hidden border border-slate-600 relative group">
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded flex items-center gap-1 z-10">
                    <MapIcon className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">Spatial Distribution</span>
                  </div>
                  <img src={msg.mapUrl} alt="Crop Distribution Map" className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              <Bot className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-emerald-500 animate-spin" />
              <span className="text-sm text-slate-400">Querying database...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-900 border-t border-slate-800">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Ask about crop production, area, or maps..." 
            className="flex-1 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 rounded-xl focus-visible:ring-emerald-500"
          />
          <Button type="submit" disabled={isLoading || !input.trim()} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-4">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};