
import {
    Box,
    VStack,
    Textarea,
    Button,
    Text,
    useToast,
    Spinner,
    HStack,
    FormControl,
} from '@chakra-ui/react';
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { NoteItem, Note } from './NoteItem';

interface NotesTabProps {
    documentId: string;
}

export function NotesTab({ documentId }: NotesTabProps) {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [newNoteContent, setNewNoteContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { user } = useAuth();
    const toast = useToast();

    const fetchNotes = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get(`/api/notes/documents/${documentId}`);
            setNotes(response.data);
        } catch (error) {
            console.error('Error fetching notes:', error);
            toast({
                title: 'Error',
                description: 'Failed to load notes',
                status: 'error',
                duration: 3000,
                isClosable: true,
            });
        } finally {
            setLoading(false);
        }
    }, [documentId, toast]);

    useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);

    const handleAddNote = async () => {
        if (!newNoteContent.trim()) return;

        try {
            setSubmitting(true);
            const response = await api.post(`/api/notes/documents/${documentId}`, {
                content: newNoteContent,
            });

            setNotes((prev) => [response.data, ...prev]);
            setNewNoteContent('');
            toast({
                title: 'Success',
                description: 'Note added',
                status: 'success',
                duration: 2000,
                isClosable: true,
            });
        } catch (error) {
            console.error('Error adding note:', error);
            toast({
                title: 'Error',
                description: 'Failed to add note',
                status: 'error',
                duration: 3000,
                isClosable: true,
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateNote = async (noteId: string, content: string) => {
        try {
            const response = await api.put(`/api/notes/${noteId}`, { content });
            setNotes((prev) =>
                prev.map((n) => (n.id === noteId ? response.data : n))
            );
            toast({
                title: 'Success',
                description: 'Note updated',
                status: 'success',
                duration: 2000,
                isClosable: true,
            });
        } catch (error) {
            console.error('Error updating note:', error);
            toast({
                title: 'Error',
                description: 'Failed to update note',
                status: 'error',
                duration: 3000,
                isClosable: true,
            });
            throw error; // Propagate to NoteItem to reset state if needed
        }
    };

    const handleDeleteNote = async (noteId: string) => {
        if (!window.confirm('Are you sure you want to delete this note?')) return;

        try {
            await api.delete(`/api/notes/${noteId}`);
            setNotes((prev) => prev.filter((n) => n.id !== noteId));
            toast({
                title: 'Success',
                description: 'Note deleted',
                status: 'success',
                duration: 2000,
                isClosable: true,
            });
        } catch (error) {
            console.error('Error deleting note:', error);
            toast({
                title: 'Error',
                description: 'Failed to delete note',
                status: 'error',
                duration: 3000,
                isClosable: true,
            });
        }
    };

    return (
        <VStack spacing={4} align="stretch" h="100%">
            <Box flexShrink={0}>
                <FormControl>
                    <VStack align="stretch" spacing={2}>
                        <Textarea
                            value={newNoteContent}
                            onChange={(e) => setNewNoteContent(e.target.value)}
                            placeholder="Add a note..."
                            rows={3}
                            resize="vertical"
                        />
                        <HStack justify="flex-end">
                            <Button
                                colorScheme="blue"
                                size="sm"
                                onClick={handleAddNote}
                                isLoading={submitting}
                                isDisabled={!newNoteContent.trim()}
                            >
                                Add Note
                            </Button>
                        </HStack>
                    </VStack>
                </FormControl>
            </Box>

            <Box flex={1} overflowY="auto">
                {loading ? (
                    <HStack justify="center" p={4}>
                        <Spinner />
                    </HStack>
                ) : notes.length === 0 ? (
                    <Text color="gray.500" fontStyle="italic" textAlign="center" mt={4}>
                        No notes yet. Add one to track feedback.
                    </Text>
                ) : (
                    <VStack spacing={3} align="stretch" pb={4}>
                        {notes.map((note) => (
                            <NoteItem
                                key={note.id}
                                note={note}
                                currentUserId={user?.id}
                                onUpdate={handleUpdateNote}
                                onDelete={handleDeleteNote}
                            />
                        ))}
                    </VStack>
                )}
            </Box>
        </VStack>
    );
}
