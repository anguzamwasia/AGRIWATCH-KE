import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "../config";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Layers,
  Calendar,
  MapPin,
  FileText,
  Loader2,
  Check,
  ChevronsUpDown,
  Globe,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import axios from "axios";

interface MapControlsProps {
  selectedCounty: string;
  selectedSubcounty: string;
  selectedYear: number;
  selectedCrop: string;
  mapLayer: "osm" | "satellite" | "pixel" | "lulc";
  onCountyChange: (county: string) => void;
  onSubcountyChange: (subcounty: string) => void;
  onYearChange: (year: number) => void;
  onCropChange: (crop: string) => void;
  onLayerChange: (layer: "osm" | "satellite" | "pixel" | "lulc") => void;
  onDownloadReport: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  isGeneratingReport?: boolean;
}

const years = Array.from({ length: 10 }, (_, i) => 2017 + i);
const crops = ["Maize", "Wheat", "Potatoes", "Pigeonpeas"];

export const MapControls = ({
  selectedCounty,
  selectedSubcounty,
  selectedYear,
  selectedCrop,
  mapLayer,
  onCountyChange,
  onSubcountyChange,
  onYearChange,
  onCropChange,
  onLayerChange,
  onDownloadReport,
  isCollapsed,
  setIsCollapsed,
  isGeneratingReport = false,
}: MapControlsProps) => {
  const [counties, setCounties] = useState<string[]>([]);
  const [subcountyMapping, setSubcountyMapping] = useState<
    Record<string, string[]>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [openCounty, setOpenCounty] = useState(false);
  const [openSubcounty, setOpenSubcounty] = useState(false);

  // Standalone logic for National View
  const isNationalView = selectedCounty === "Kenya";

  useEffect(() => {
    const fetchLocations = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/api/locations`);
        // Keep Kenya out of the list for standalone behavior
        setCounties(response.data.counties || []);
        setSubcountyMapping(response.data.mapping || {});
      } catch (error) {
        console.error("Backend connection failed.", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLocations();
  }, []);

  const availableSubcounties = subcountyMapping[selectedCounty] || [];

  return (
    <div
      className={cn(
        "bg-slate-900 shadow-2xl border border-slate-800 rounded-[2rem] text-slate-200 relative z-50 transition-all duration-300 flex flex-col h-full",
        isCollapsed ? "p-4 items-center" : "p-6 space-y-6",
      )}
    >
      <div
        className={cn(
          "flex items-center w-full",
          isCollapsed ? "justify-center" : "justify-between mb-2",
        )}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-emerald-500" />
            <h3 className="text-lg font-bold text-white">Location & Time</h3>
          </div>
        )}
        <div className="flex items-center gap-3">
          {!isCollapsed && isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "p-0",
              isCollapsed
                ? "h-12 w-12 rounded-xl bg-slate-800/50 hover:bg-slate-700"
                : "h-8 w-8",
            )}
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronRight className="h-6 w-6 text-emerald-400" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="space-y-6 flex-1 w-full overflow-y-auto pr-2 custom-scrollbar">
          {/* Standalone National View Toggle */}
          <Button
            variant={isNationalView ? "default" : "outline"}
            className={cn(
              "w-full gap-2 transition-all",
              isNationalView
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "hover:border-emerald-300",
            )}
            onClick={() => {
              onCountyChange("Kenya");
              onSubcountyChange("");
            }}
          >
            <Globe className="h-4 w-4" />
            Analyze Entire Country
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or specific region
              </span>
            </div>
          </div>

          {/* County Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              County
            </label>
            <Popover open={openCounty} onOpenChange={setOpenCounty}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-between font-normal",
                    isNationalView && "opacity-50",
                  )}
                  disabled={isLoading}
                >
                  {isNationalView
                    ? "Select a county..."
                    : selectedCounty || "Select location..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search county..." />
                  <CommandEmpty>No county found.</CommandEmpty>
                  <CommandGroup className="max-h-60 overflow-y-auto">
                    {counties.map((county) => (
                      <CommandItem
                        key={county}
                        value={county}
                        onSelect={() => {
                          onCountyChange(county);
                          onSubcountyChange("");
                          setOpenCounty(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedCounty === county
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {county}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Subcounty Selection */}
          {!isNationalView && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Subcounty
              </label>
              <Popover open={openSubcounty} onOpenChange={setOpenSubcounty}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between font-normal"
                    disabled={availableSubcounties.length === 0}
                  >
                    {selectedSubcounty ? selectedSubcounty : "Entire County"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Search subcounty..." />
                    <CommandEmpty>No subcounty found.</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-y-auto">
                      <CommandItem
                        value="entire-county"
                        onSelect={() => {
                          onSubcountyChange("");
                          setOpenSubcounty(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedSubcounty === ""
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        Entire County
                      </CommandItem>
                      {availableSubcounties.map((sub) => (
                        <CommandItem
                          key={sub}
                          value={sub}
                          onSelect={(currentValue) => {
                            onSubcountyChange(currentValue);
                            setOpenSubcounty(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedSubcounty === sub
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {sub}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Simplified Predictor Context: Crop & Year */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Crop
              </label>
              <Select value={selectedCrop} onValueChange={onCropChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {crops.map((crop) => (
                    <SelectItem key={crop} value={crop}>
                      {crop}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-3 w-3" /> Year
              </label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => onYearChange(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Map Layer */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Layers className="h-4 w-4" /> Map Layer
            </label>
            <div className="grid grid-cols-4 gap-1 bg-muted rounded-md p-1">
              {["satellite", "pixel", "lulc", "osm"].map((layer) => (
                <Button
                  key={layer}
                  variant={mapLayer === layer ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => onLayerChange(layer as any)}
                  className={cn(
                    "text-xs capitalize py-1 h-8 px-1",
                    mapLayer === layer ? "bg-background shadow-sm" : "",
                  )}
                >
                  {layer === "osm" ? "Map" : layer === "pixel" ? "Yield" : layer === "lulc" ? "LULC" : "Sat"}
                </Button>
              ))}
            </div>
          </div>



          {/* Active Context */}
          <div className="pt-4 border-t border-slate-800">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Selected Analysis
            </h4>
            <div className="flex flex-wrap gap-1.5">
              <Badge
                variant="secondary"
                className="bg-emerald-900/40 text-emerald-400 border border-emerald-800/50"
              >
                {isNationalView ? "Kenya (National)" : selectedCounty}
              </Badge>
              {!isNationalView && selectedSubcounty && (
                <Badge
                  variant="outline"
                  className="text-[10px] border-slate-700 text-slate-300 bg-slate-800/50"
                >
                  {selectedSubcounty}
                </Badge>
              )}
              <Badge
                variant="outline"
                className="text-[10px] border-slate-700 text-slate-300 bg-slate-800/50"
              >
                {selectedYear}
              </Badge>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};