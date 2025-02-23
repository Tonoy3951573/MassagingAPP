import { useQuery } from '@tanstack/react-query';
import { Conversation, User } from '@shared/schema';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Plus, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { NewConversationDialog } from './new-conversation-dialog';
import { format } from 'date-fns';

type ConversationListProps = {
  onSelectConversation: (conversation: Conversation) => void;
  selectedConversationId?: number;
};

export function ConversationList({ onSelectConversation, selectedConversationId }: ConversationListProps) {
  const [showNewConversationDialog, setShowNewConversationDialog] = useState(false);

  const { data: conversations } = useQuery<Conversation[]>({
    queryKey: ['/api/conversations'],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  if (!conversations || !users) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Chats</h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowNewConversationDialog(true)}
          className="hover:bg-accent"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-1">
          {conversations.map((conversation) => (
            <Button
              key={conversation.id}
              variant={selectedConversationId === conversation.id ? "secondary" : "ghost"}
              className="w-full justify-start p-3 hover:bg-accent"
              onClick={() => onSelectConversation(conversation)}
            >
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-full">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">
                    {conversation.name || 'Private Chat'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {format(new Date(conversation.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </ScrollArea>
      <NewConversationDialog
        open={showNewConversationDialog}
        onOpenChange={setShowNewConversationDialog}
        users={users}
      />
    </div>
  );
}