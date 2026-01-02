import {
    Box,
    Text,
    HStack,
    VStack,
    Avatar,
    IconButton,
    Menu,
    MenuButton,
    MenuList,
    MenuItem,
    Textarea,
    Button,
    ButtonGroup,
    useToast,
} from '@chakra-ui/react';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { useState } from 'react';
import DOMPurify from 'dompurify';

interface User {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string; // Optional
}

export interface Note {
    id: string;
    documentId: string;
    authorId: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    author: User;
}

interface NoteItemProps {
    note: Note;
    currentUserId?: string;
    onUpdate: (noteId: string, content: string) => Promise<void>;
    onDelete: (noteId: string) => Promise<void>;
}

export function NoteItem({ note, currentUserId, onUpdate, onDelete }: NoteItemProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(note.content);
    const [isSaving, setIsSaving] = useState(false);
    const toast = useToast();

    const isAuthor = currentUserId === note.authorId;
    const isEdited = new Date(note.createdAt).getTime() !== new Date(note.updatedAt).getTime();

    const handleSave = async () => {
        if (!editContent.trim()) {
            toast({
                title: 'Content cannot be empty',
                status: 'warning',
                duration: 3000,
            });
            return;
        }

        try {
            setIsSaving(true);
            await onUpdate(note.id, editContent);
            setIsEditing(false);
        } catch (error) {
            // Error handling is done in parent, but good to catch here too if needed
        } finally {
            setIsSaving(false);
        }
    };

    const cancelEdit = () => {
        setEditContent(note.content);
        setIsEditing(false);
    };

    const getRelativeTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "y ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "mo ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m ago";
        return "just now";
    };

    // Convert URLs to clickable links
    const linkify = (text: string) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, (url) => {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
    };

    // Linkify and then sanitize content
    const sanitizedContent = DOMPurify.sanitize(linkify(note.content), {
        ADD_ATTR: ['target']
    });

    return (
        <Box p={4} borderWidth="1px" borderRadius="md" bg="white" boxShadow="sm" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
            <HStack align="start" spacing={3}>
                <Avatar
                    size="sm"
                    name={note.author.displayName}
                    src={note.author.avatarUrl}
                />
                <VStack align="stretch" flex={1} spacing={1}>
                    <HStack justify="space-between">
                        <HStack>
                            <Text fontWeight="bold" fontSize="sm">{note.author.displayName}</Text>
                            <Text fontSize="xs" color="gray.500">
                                {getRelativeTime(note.createdAt)}
                                {isEdited && ' (edited)'}
                            </Text>
                        </HStack>
                        {isAuthor && !isEditing && (
                            <Menu>
                                <MenuButton
                                    as={IconButton}
                                    icon={<ChevronDownIcon />}
                                    variant="ghost"
                                    size="xs"
                                    aria-label="Note options"
                                />
                                <MenuList>
                                    <MenuItem onClick={() => setIsEditing(true)}>Edit</MenuItem>
                                    <MenuItem onClick={() => onDelete(note.id)} color="red.500">Delete</MenuItem>
                                </MenuList>
                            </Menu>
                        )}
                    </HStack>

                    {isEditing ? (
                        <VStack align="stretch" mt={2}>
                            <Textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                minH="100px"
                                size="sm"
                            />
                            <ButtonGroup size="sm" justifyContent="flex-end">
                                <Button onClick={cancelEdit} isDisabled={isSaving}>Cancel</Button>
                                <Button colorScheme="blue" onClick={handleSave} isLoading={isSaving}>Save</Button>
                            </ButtonGroup>
                        </VStack>
                    ) : (
                        <Box
                            fontSize="sm"
                            mt={1}
                            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                            sx={{
                                'a': { color: 'blue.500', textDecoration: 'underline' },
                                'p': { marginBottom: '0.5rem' },
                                'ul, ol': { marginLeft: '1.5rem', marginBottom: '0.5rem' }
                            }}
                        />
                    )}
                </VStack>
            </HStack>
        </Box>
    );
}
