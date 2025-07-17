import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Clock, Plus, X, Settings, Calendar, Mail } from "lucide-react";
import { getAvailableVoices } from "@/lib/voices";

const scheduleFormSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  times: z.array(z.string()).min(1, "At least one time is required"),
  timezone: z.string().default('UTC'),
  durationMinutes: z.number().min(5).max(30).default(10),
  voiceId: z.string(),
  email: z.string().email("Invalid email address"),
  isActive: z.boolean().default(true)
});

type ScheduleFormData = z.infer<typeof scheduleFormSchema>;

const timeZones = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona Time (MST)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKST)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
  { value: 'Europe/London', label: 'London Time (GMT)' },
  { value: 'Europe/Paris', label: 'Paris Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo Time (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai Time (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney Time (AEST)' }
];

export function PodcastScheduleForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newTime, setNewTime] = useState('');
  const [availableVoices, setAvailableVoices] = useState([]);

  // Fetch existing schedule
  const { data: existingSchedule, isLoading: isLoadingSchedule } = useQuery({
    queryKey: ['/api/podcast-schedule'],
    retry: false
  });

  // Fetch available voices
  useEffect(() => {
    const voices = getAvailableVoices();
    setAvailableVoices(voices);
  }, []);

  const form = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      frequency: 'daily',
      times: ['07:00'],
      timezone: 'UTC',
      durationMinutes: 10,
      voiceId: '',
      email: '',
      isActive: true
    }
  });

  // Update form when existing schedule is loaded
  useEffect(() => {
    if (existingSchedule) {
      form.reset({
        frequency: existingSchedule.frequency,
        times: existingSchedule.times || ['07:00'],
        timezone: existingSchedule.timezone || 'UTC',
        durationMinutes: existingSchedule.durationMinutes || 10,
        voiceId: existingSchedule.voiceId || '',
        email: existingSchedule.email || '',
        isActive: existingSchedule.isActive !== undefined ? existingSchedule.isActive : true
      });
    }
  }, [existingSchedule, form]);

  const createScheduleMutation = useMutation({
    mutationFn: (data: ScheduleFormData) => apiRequest('/api/podcast-schedule', {
      method: 'POST',
      body: data
    }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Podcast schedule created successfully!"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/podcast-schedule'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create schedule",
        variant: "destructive"
      });
    }
  });

  const updateScheduleMutation = useMutation({
    mutationFn: (data: ScheduleFormData) => apiRequest(`/api/podcast-schedule/${existingSchedule.id}`, {
      method: 'PUT',
      body: data
    }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Podcast schedule updated successfully!"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/podcast-schedule'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update schedule",
        variant: "destructive"
      });
    }
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: () => apiRequest(`/api/podcast-schedule/${existingSchedule.id}`, {
      method: 'DELETE'
    }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Podcast schedule deleted successfully!"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/podcast-schedule'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete schedule",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: ScheduleFormData) => {
    if (existingSchedule) {
      updateScheduleMutation.mutate(data);
    } else {
      createScheduleMutation.mutate(data);
    }
  };

  const handleDeleteSchedule = () => {
    if (confirm('Are you sure you want to delete this podcast schedule?')) {
      deleteScheduleMutation.mutate();
    }
  };

  const addTime = () => {
    if (newTime && !form.getValues('times').includes(newTime)) {
      const currentTimes = form.getValues('times');
      form.setValue('times', [...currentTimes, newTime]);
      setNewTime('');
    }
  };

  const removeTime = (timeToRemove: string) => {
    const currentTimes = form.getValues('times');
    form.setValue('times', currentTimes.filter(time => time !== timeToRemove));
  };

  if (isLoadingSchedule) {
    return <div className="flex justify-center p-8">Loading schedule...</div>;
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Podcast Schedule
        </CardTitle>
        <CardDescription>
          Set up automatic podcast generation and delivery
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timeZones.map(tz => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="times"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery Times</FormLabel>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        placeholder="Add time"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addTime}
                        disabled={!newTime}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {field.value.map((time, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {time}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 ml-1"
                            onClick={() => removeTime(time)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <FormDescription>
                    Add one or more times when podcasts should be delivered
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="durationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={5}
                        max={30}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>5-30 minutes</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="voiceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voice</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select voice" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableVoices.map(voice => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Podcasts will be delivered to this email address
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Schedule</FormLabel>
                    <FormDescription>
                      Enable automatic podcast generation and delivery
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-between">
              <div>
                {existingSchedule && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteSchedule}
                    disabled={deleteScheduleMutation.isPending}
                  >
                    Delete Schedule
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={createScheduleMutation.isPending || updateScheduleMutation.isPending}
                >
                  {existingSchedule ? 'Update Schedule' : 'Create Schedule'}
                </Button>
              </div>
            </div>
          </form>
        </Form>

        {existingSchedule && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">Schedule Status</h4>
            <p className="text-sm text-muted-foreground">
              Next delivery: {existingSchedule.nextSend ? new Date(existingSchedule.nextSend).toLocaleString() : 'Not scheduled'}
            </p>
            <p className="text-sm text-muted-foreground">
              Last sent: {existingSchedule.lastSent ? new Date(existingSchedule.lastSent).toLocaleString() : 'Never'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}