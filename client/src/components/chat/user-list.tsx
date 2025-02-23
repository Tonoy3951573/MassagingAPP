import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Conversation } from '@shared/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';

type UserListProps = {
  onSelectUser?: (user: User, conversation: Conversation) => void;
};

export function UserList({ onSelectUser }: UserListProps) {
  const { data: users } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const { data: conversations } = useQuery<Conversation[]>({
    queryKey: ['/api/conversations'],
  });

  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const createPrivateChat = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest('POST', '/api/conversations', {
        type: 'private',
        name: null,
        userIds: [userId]
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    }
  });

  const handleUserClick = async (selectedUser: User) => {
    if (onSelectUser) {
      try {
        const result = await createPrivateChat.mutateAsync(selectedUser.id);
        onSelectUser(selectedUser, result);
      } catch (error) {
        console.error('Failed to create/get conversation:', error);
      }
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Users ({users?.length || 0}/10)</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-4">
            {users?.filter(user => user.id !== currentUser?.id).map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                onClick={() => handleUserClick(user)}
              >
                <Avatar>
                  <AvatarFallback>
                    {user.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.isActive ? (
                      <span className="text-green-500">Online</span>
                    ) : user.lastSeen ? (
                      <>
                        Last seen{' '}
                        {formatDistanceToNow(new Date(user.lastSeen), {
                          addSuffix: true,
                        })}
                      </>
                    ) : (
                      'Never connected'
                    )}
                  </p>
                </div>
                {user.isActive && (
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}