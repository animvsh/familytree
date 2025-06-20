const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Relationship Schema
 * Defines the structure for relationship documents in MongoDB.
 * Each document represents a directional link between two users.
 */
const RelationshipSchema = new Schema({
  // user1: The user who is defining or initiating the relationship.
  // This can be thought of as the 'source' of a directed edge in a graph.
  user1: {
    type: Schema.Types.ObjectId, // References a User document's _id
    ref: 'User',                 // Links to the 'User' model
    required: [true, 'User1 (initiator) is required for a relationship.'],
  },
  // user2: The user who is being related to.
  // This can be thought of as the 'target' of a directed edge.
  user2: {
    type: Schema.Types.ObjectId, // References a User document's _id
    ref: 'User',                 // Links to the 'User' model
    required: [true, 'User2 (target) is required for a relationship.'],
  },
  // relationshipType: Describes the nature of the relationship from user1's perspective.
  // For example, if user1 is "Parent" of user2.
  relationshipType: {
    type: String,
    required: [true, 'Relationship type is required.'],
    enum: [ // Defines a list of allowed values for relationshipType
      'Parent', 'Sibling', 'Spouse', 'Child',
      'Cousin', 'Aunt/Uncle', 'Niece/Nephew',
      'Grandparent', 'Grandchild',
      'Friend', 'Other'
      // Consider adding more specific types or allowing user-defined types if needed.
    ],
  },
  // Optional: A field for the reverse relationship type could be added.
  // For example, if user1 is "Parent" of user2, user2 is "Child" of user1.
  // This can be useful for optimizing queries that need to see relationships from both perspectives
  // without calculating the inverse on the fly. However, it adds complexity to keep it synced.
  // For MVP, this is omitted and can be handled at the application or query level.
  // reverseRelationshipType: {
  //   type: String,
  //   enum: [...] // Could have its own enum if different from relationshipType
  // },
  createdAt: {
    type: Date,
    default: Date.now, // Automatically set to the current date and time when a relationship is created
  },
});

// Compound Index to ensure uniqueness for a specific relationship type in one direction.
// This prevents creating the exact same relationship (e.g., UserA -> "Parent" -> UserB) multiple times.
// It does NOT prevent UserA -> "Child" -> UserB if UserA -> "Parent" -> UserB already exists,
// as that would be a different relationshipType.
// It also does NOT prevent UserB -> "Child" -> UserA (inverse relationship).
RelationshipSchema.index({ user1: 1, user2: 1, relationshipType: 1 }, { unique: true });

// Additional considerations for Relationship model:
// 1. Bidirectional Relationships:
//    - For relationships that are inherently bidirectional (e.g., "Spouse", "Sibling"),
//      you might automatically create the inverse relationship document when one is added.
//      E.g., if A adds B as "Spouse", automatically create B adds A as "Spouse".
//      This requires careful handling of duplicates and updates.
// 2. Relationship Properties:
//    - You could add fields like 'startDate', 'endDate' (for relationships like marriage or employment),
//      or 'status' (e.g., 'pending', 'confirmed' for friend requests).
// 3. Validation:
//    - Ensure user1 and user2 are not the same person if the relationship type implies two different individuals.
//      This can be done with a custom validator on the schema:
//      UserSchema.path('user2').validate(function(value) {
//        return this.user1.toString() !== value.toString();
//      }, 'User1 and User2 cannot be the same person for this relationship.');

// Create and export the Relationship model.
// Mongoose will create a 'relationships' collection in MongoDB.
module.exports = mongoose.model('Relationship', RelationshipSchema);
