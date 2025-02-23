import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useWebSocket } from '@/hooks/use-websocket';
import { MessageList } from '@/components/chat/message-list';
import { MessageInput } from '@/components/chat/message-input';
import { UserList } from '@/components/chat/user-list';
import { ConversationList } from '@/components/chat/conversation-list';
import { Button } from '@/components/ui/button';
import { LogOut, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Conversation } from '@shared/schema';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function ChatPage() {
  const { user, logoutMutation } = useAuth();
  const { lastMessage } = useWebSocket();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  const { data: users, isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const { data: conversations } = useQuery<Conversation[]>({
    queryKey: ['/api/conversations'],
  });

  useEffect(() => {
    if (lastMessage?.type === 'new_message') {
      queryClient.invalidateQueries({ queryKey: ['/api/messages', selectedConversation?.id] });
    }
  }, [lastMessage, queryClient, selectedConversation?.id]);

  const handleUserSelect = (selectedUser: User, conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  if (isLoadingUsers) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="grid grid-cols-12 h-screen">
        {/* Sidebar */}
        <div className="col-span-3 bg-muted border-r">
          <div className="p-4 bg-primary-foreground border-b flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Avatar>
                <AvatarFallback>
                  {user?.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{user?.username}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
          <div className="space-y-4 p-4">
            <ConversationList
              onSelectConversation={setSelectedConversation}
              selectedConversationId={selectedConversation?.id}
            />
            <UserList onSelectUser={handleUserSelect} />
          </div>
        </div>

        {/* Chat Area */}
        <div className="col-span-9 flex flex-col">
          {selectedConversation ? (
            <>
              <div className="p-4 bg-primary-foreground border-b">
                <h2 className="text-lg font-semibold">
                  {selectedConversation.name || 'Private Chat'}
                </h2>
              </div>
              <div className="flex-1 overflow-hidden bg-chat-pattern">
                {users && <MessageList users={users} conversationId={selectedConversation.id} />}
              </div>
              <div className="p-4 bg-background border-t">
                <MessageInput
                  conversationId={selectedConversation.id}
                  onMessageSent={() =>
                    queryClient.invalidateQueries({ queryKey: ['/api/messages', selectedConversation.id] })
                  }
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a conversation or start a new one
            </div>
          )}
        </div>
      </div>
    </div>
  );
}