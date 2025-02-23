import { useQuery } from '@tanstack/react-query';
import { Conversation, User } from '@shared/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Plus, Users } from 'lucide-react';
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
    <Card className="h-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Conversations</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNewConversationDialog(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <Button
                key={conversation.id}
                variant={selectedConversationId === conversation.id ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => onSelectConversation(conversation)}
              >
                <Users className="h-4 w-4 mr-2" />
                <div className="flex-1 text-left">
                  <p className="font-medium">
                    {conversation.name || 'Private Chat'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(conversation.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <NewConversationDialog
        open={showNewConversationDialog}
        onOpenChange={setShowNewConversationDialog}
        users={users}
      />
    </Card>
  );
}
