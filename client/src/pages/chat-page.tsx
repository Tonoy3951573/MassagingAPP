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
import { Separator } from '@/components/ui/separator';

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
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="w-80 flex flex-col border-r bg-muted/30">
        {/* User Profile */}
        <div className="p-4 bg-card border-b backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {user?.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">{user?.username}</h3>
                <p className="text-xs text-muted-foreground">Online</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto space-y-4 p-4">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-2">
              Conversations
            </h2>
            <ConversationList
              onSelectConversation={setSelectedConversation}
              selectedConversationId={selectedConversation?.id}
            />
          </div>
          <Separator className="bg-border/50" />
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-2">
              Users
            </h2>
            <UserList onSelectUser={handleUserSelect} />
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gradient-to-b from-background to-background/95">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-[60px] px-6 flex items-center justify-between border-b bg-card/50 backdrop-blur-sm">
              <h2 className="text-lg font-semibold">
                {selectedConversation.name || 'Private Chat'}
              </h2>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-[url('/chat-pattern.svg')] bg-repeat bg-opacity-5">
              {users && <MessageList users={users} conversationId={selectedConversation.id} />}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-background/95 border-t backdrop-blur-sm">
              <MessageInput
                conversationId={selectedConversation.id}
                onMessageSent={() =>
                  queryClient.invalidateQueries({ queryKey: ['/api/messages', selectedConversation.id] })
                }
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <p className="text-lg">Welcome to Private Messenger</p>
              <p className="text-sm">Select a conversation or start a new one to begin messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}