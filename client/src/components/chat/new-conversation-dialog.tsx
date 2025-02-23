import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { User } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';

type NewConversationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
};

export function NewConversationDialog({ open, onOpenChange, users }: NewConversationDialogProps) {
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [groupName, setGroupName] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const createConversationMutation = useMutation({
    mutationFn: async (data: { name: string | null; type: 'private' | 'group'; userIds: number[] }) => {
      const res = await apiRequest('POST', '/api/conversations', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      onOpenChange(false);
      setSelectedUsers([]);
      setGroupName('');
      toast({
        title: 'Success',
        description: 'Conversation created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error creating conversation',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCreateConversation = () => {
    if (selectedUsers.length === 0) {
      toast({
        title: 'Select users',
        description: 'Please select at least one user to chat with',
        variant: 'destructive',
      });
      return;
    }

    const isGroup = selectedUsers.length > 1;
    if (isGroup && !groupName.trim()) {
      toast({
        title: 'Group name required',
        description: 'Please enter a name for the group chat',
        variant: 'destructive',
      });
      return;
    }

    createConversationMutation.mutate({
      name: isGroup ? groupName : null,
      type: isGroup ? 'group' : 'private',
      userIds: selectedUsers,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Users</Label>
            <ScrollArea className="h-[200px] border rounded-md p-4">
              <div className="space-y-2">
                {users
                  .filter((u) => u.id !== currentUser?.id)
                  .map((user) => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={selectedUsers.includes(user.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedUsers([...selectedUsers, user.id]);
                          } else {
                            setSelectedUsers(selectedUsers.filter((id) => id !== user.id));
                          }
                        }}
                      />
                      <Label htmlFor={`user-${user.id}`}>{user.username}</Label>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </div>
          {selectedUsers.length > 1 && (
            <div className="space-y-2">
              <Label>Group Name</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name"
              />
            </div>
          )}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateConversation} disabled={createConversationMutation.isPending}>
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
