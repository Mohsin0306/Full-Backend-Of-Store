const Chat = require('../models/Chat');
const Seller = require('../models/Seller');
const Buyer = require('../models/Buyer');


exports.getBuyerAdminChats = async (req, res) => {
    try {
        // Get the buyer's ID from the authenticated user
        const buyerId = req.user.id;

        // Find all admins/sellers with business details
        const admins = await Seller.find(
            { isAdmin: true },
            'name username profilePicture businessDetails.companyName'
        );

        // Find existing chats for this buyer with admins
        const existingChats = await Chat.find({
            participants: buyerId,
            participantModel: 'Buyer'
        }).populate({
            path: 'participants',
            match: { isAdmin: true },
            select: 'name username profilePicture businessDetails.companyName'
        });

        // Create a map of existing chats by admin ID
        const chatsByAdminId = {};
        existingChats.forEach(chat => {
            const admin = chat.participants.find(p => p.isAdmin);
            if (admin) {
                chatsByAdminId[admin._id.toString()] = chat;
            }
        });

        // Format the response
        const formattedAdmins = admins.map(admin => ({
            _id: admin._id,
            name: admin.businessDetails?.companyName || admin.name,
            username: admin.username,
            profilePicture: admin.profilePicture,
            chatId: chatsByAdminId[admin._id.toString()]?._id || null,
            lastMessage: chatsByAdminId[admin._id.toString()]?.lastMessage || '',
            lastMessageTime: chatsByAdminId[admin._id.toString()]?.lastMessageTime || null,
            unreadCount: chatsByAdminId[admin._id.toString()]?.unreadCount || 0
        }));

        res.status(200).json({
            success: true,
            data: formattedAdmins
        });
    } catch (error) {
        console.error('Error in getBuyerAdminChats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching admin chats',
            error: error.message
        });
    }
};

// Admin endpoint to get all buyer chats
exports.getAdminBuyerChats = async (req, res) => {
    try {
        const adminId = req.user.id;

        // First, get all buyers
        const buyers = await Buyer.find({}, 'name username profilePicture');

        // Then get existing chats
        const existingChats = await Chat.find({
            participants: adminId,
            participantModel: 'Seller'
        }).populate({
            path: 'participants',
            match: { isAdmin: { $ne: true } },
            model: 'Buyer',
            select: 'name username profilePicture'
        });

        // Create a map of existing chats by buyer ID
        const chatsByBuyerId = {};
        existingChats.forEach(chat => {
            const buyer = chat.participants.find(p => !p.isAdmin);
            if (buyer) {
                chatsByBuyerId[buyer._id.toString()] = chat;
            }
        });

        // Format the response to include all buyers
        const formattedBuyers = buyers.map(buyer => ({
            _id: buyer._id,
            buyer: {
                _id: buyer._id,
                name: buyer.name,
                username: buyer.username,
                profilePicture: buyer.profilePicture
            },
            lastMessage: chatsByBuyerId[buyer._id.toString()]?.lastMessage || '',
            lastMessageTime: chatsByBuyerId[buyer._id.toString()]?.lastMessageTime || null,
            unreadCount: chatsByBuyerId[buyer._id.toString()]?.unreadCount || 0
        }));

        res.status(200).json({
            success: true,
            data: formattedBuyers
        });
    } catch (error) {
        console.error('Error in getAdminBuyerChats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching buyer chats',
            error: error.message
        });
    }
};
