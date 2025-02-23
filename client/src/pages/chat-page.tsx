import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useWebSocket } from '@/hooks/use-websocket';
import { MessageList } from '@/components/chat/message-list';
import { MessageInput } from '@/components/chat/message-input';
import { UserList } from '@/components/chat/user-list';
import { ConversationList } from '@/components/chat/conversation-list';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Conversation } from '@shared/schema';

export default function ChatPage() {
  const { user, logoutMutation } = useAuth();
  const { lastMessage } = useWebSocket();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  const { data: users } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  useEffect(() => {
    if (lastMessage?.type === 'new_message') {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    }
  }, [lastMessage, queryClient]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Private Messenger</h1>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">
              Logged in as {user?.username}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3">
            <div className="space-y-6">
              <ConversationList
                onSelectConversation={setSelectedConversation}
                selectedConversationId={selectedConversation?.id}
              />
              <UserList />
            </div>
          </div>
          <div className="col-span-9 space-y-4">
            {selectedConversation ? (
              <>
                {users && <MessageList users={users} conversationId={selectedConversation.id} />}
                <MessageInput
                  conversationId={selectedConversation.id}
                  onMessageSent={() =>
                    queryClient.invalidateQueries({ queryKey: ['/api/messages'] })
                  }
                />
              </>
            ) : (
              <div className="flex items-center justify-center h-[calc(100vh-200px)] text-muted-foreground">
                Select a conversation or start a new one
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}