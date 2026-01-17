import React, { useState, useEffect } from 'react';
import { XCircle, Play, Loader2 } from 'lucide-react';
import { type Skill } from '../../../api/endpoints/skills';

interface SkillSelectionModalProps {
    itemId: string;
    onClose: () => void;
    onTriggerSkill: (skillName: string) => Promise<void>;
}

export const SkillSelectionModal: React.FC<SkillSelectionModalProps> = ({ itemId, onClose, onTriggerSkill }) => {
    const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
    const [isLoadingSkills, setIsLoadingSkills] = useState(false);

    useEffect(() => {
        setIsLoadingSkills(true);
        import('../../../api')
            .then(m => m.listSkills())
            .then(skills => setAvailableSkills(skills))
            .catch(err => console.error("Failed to load skills", err))
            .finally(() => setIsLoadingSkills(false));
    }, []);

    return (
        <div className="task-details-overlay fade-in" onClick={onClose}>
            <div className="task-details-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="task-details-header">
                    <h4>Run New Task</h4>
                    <button className="close-btn" onClick={onClose}>
                        <XCircle size={16} />
                    </button>
                </div>
                <div className="task-details-body" style={{ background: 'var(--bg-card)' }}>
                    {isLoadingSkills ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                            <Loader2 className="spin" />
                        </div>
                    ) : availableSkills.length === 0 ? (
                        <p style={{ padding: '1rem', color: 'var(--text-muted)' }}>No skills available.</p>
                    ) : (
                        <div className="skills-list" style={{ padding: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
                            {availableSkills.map((skill: Skill) => (
                                <div 
                                    key={skill.name} 
                                    className="skill-item"
                                    onClick={() => onTriggerSkill(skill.name)}
                                    style={{ 
                                        padding: '1rem', 
                                        border: '1px solid var(--border-subtle)', 
                                        marginBottom: '0.5rem', 
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <div>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{skill.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{skill.description}</div>
                                    </div>
                                    <Play size={16} style={{ color: 'var(--primary)' }} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
